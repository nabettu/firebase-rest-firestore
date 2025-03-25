import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FirestoreClient,
  createFirestoreClient,
  DocumentReference,
} from "../src/client";
import { loadConfig, getTestCollectionName } from "./helpers";

/**
 * 注意: 複合クエリのテストを実行する前に、以下のフィールドに対して複合インデックスを作成する必要があります
 * - category + stock
 * - price + stock
 * - category + price
 * - category + tags (tags にはarray_contains型のインデックス)
 *
 * Firestoreコンソールから手動で作成するか、Firebase CLIを使用してデプロイしてください。
 *
 * インデックス作成例（Firebase CLIのfirestore.indexes.json):
 * ```
 * {
 *   "indexes": [
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "category", "order": "ASCENDING" },
 *         { "fieldPath": "price", "order": "ASCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "category", "order": "ASCENDING" },
 *         { "fieldPath": "stock", "order": "ASCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "price", "order": "ASCENDING" },
 *         { "fieldPath": "stock", "order": "ASCENDING" }
 *       ]
 *     },
 *     {
 *       "collectionGroup": "test_indexed_collection",
 *       "queryScope": "COLLECTION",
 *       "fields": [
 *         { "fieldPath": "category", "order": "ASCENDING" },
 *         { "fieldPath": "tags", "arrayConfig": "CONTAINS" }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */

// 固定のテストコレクション名（複合インデックス用）
const INDEXED_TEST_COLLECTION = "test_indexed_collection";
// コレクショングループテスト用の固定コレクション名
const NESTED_COLLECTION_NAME = "items";

describe("Firebase Rest Firestore", () => {
  let client: FirestoreClient;
  let testCollection: string;
  let createdIds: { collection: string; id: string }[] = [];

  beforeEach(() => {
    // 環境変数から設定を読み込みクライアントを初期化
    const config = loadConfig();
    client = createFirestoreClient(config);
    // 通常のテストでは動的なコレクション名を使用
    testCollection = getTestCollectionName();
    createdIds = [];
  });

  afterEach(async () => {
    // テストで作成したドキュメントをクリーンアップ
    for (const { collection, id } of createdIds) {
      try {
        await client.delete(collection, id);
      } catch (err) {
        console.error(
          `Clean up failed for document ${collection}/${id}: ${err}`
        );
      }
    }
  });

  // 基本的なクライアント機能テスト
  it("クライアントが正しく初期化されること", () => {
    expect(client).toBeDefined();
  });

  // 基本的なCRUD操作テスト
  it("ドキュメントの作成、読み取り、更新、削除ができること", async () => {
    // 作成テスト
    const testData = {
      name: "テストアイテム",
      value: 123,
      active: true,
    };

    const createdDoc = await client.add(testCollection, testData);
    createdIds.push({ collection: testCollection, id: createdDoc.id });

    expect(createdDoc).toBeDefined();
    expect(createdDoc.id).toBeDefined();
    expect(createdDoc.name).toBe(testData.name);
    expect(createdDoc.value).toBe(testData.value);
    expect(createdDoc.active).toBe(testData.active);

    // 読み取りテスト
    const fetchedDoc = await client.get(testCollection, createdDoc.id);
    expect(fetchedDoc).toBeDefined();
    expect(fetchedDoc?.id).toBe(createdDoc.id);
    expect(fetchedDoc?.name).toBe(testData.name);
    expect(fetchedDoc?.value).toBe(testData.value);
    expect(fetchedDoc?.active).toBe(testData.active);

    // 更新テスト
    const updateData = {
      name: "更新後のアイテム",
      active: false,
    };

    const updatedDoc = await client.update(
      testCollection,
      createdDoc.id,
      updateData
    );

    expect(updatedDoc).toBeDefined();
    expect(updatedDoc.id).toBe(createdDoc.id);
    expect(updatedDoc.name).toBe(updateData.name);
    expect(updatedDoc.value).toBe(testData.value);
    expect(updatedDoc.active).toBe(updateData.active);

    // 更新確認テスト
    const fetchedUpdatedDoc = await client.get(testCollection, createdDoc.id);
    expect(fetchedUpdatedDoc?.name).toBe(updateData.name);
    expect(fetchedUpdatedDoc?.value).toBe(testData.value);
    expect(fetchedUpdatedDoc?.active).toBe(updateData.active);

    // 削除テスト
    await client.delete(testCollection, createdDoc.id);
    const deletedDoc = await client.get(testCollection, createdDoc.id);
    expect(deletedDoc).toBeNull();

    // 削除済みのIDはクリーンアップ不要
    createdIds = createdIds.filter(
      doc => !(doc.collection === testCollection && doc.id === createdDoc.id)
    );
  });

  // リファレンスAPIテスト
  it("リファレンスAPIでのドキュメント操作ができること", async () => {
    // コレクションリファレンス
    const collRef = client.collection(testCollection);
    expect(collRef).toBeDefined();

    // ドキュメント追加
    const testData = { name: "リファレンステスト", count: 100 };
    const docRef = await collRef.add(testData);
    createdIds.push({ collection: testCollection, id: docRef.id });

    expect(docRef).toBeDefined();
    expect(docRef.id).toBeDefined();

    // ドキュメント取得
    const snapshot = await docRef.get();
    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toMatchObject(testData);

    // ドキュメント更新
    await docRef.update({
      name: "更新されたドキュメント",
      count: 200,
    });

    // 更新確認
    const updatedSnapshot = await docRef.get();
    expect(updatedSnapshot.data()?.name).toBe("更新されたドキュメント");
    expect(updatedSnapshot.data()?.count).toBe(200);

    // ドキュメント削除
    await docRef.delete();

    // 削除確認
    const deletedSnapshot = await docRef.get();
    expect(deletedSnapshot.exists).toBe(false);

    // 削除済みのIDはクリーンアップ不要
    createdIds = createdIds.filter(
      doc => !(doc.collection === testCollection && doc.id === docRef.id)
    );
  });

  // シンプルなクエリテスト
  it("基本的なクエリが実行できること", async () => {
    // テストデータを複数追加
    const testData = [
      { category: "A", price: 100, stock: true },
      { category: "B", price: 200, stock: false },
      { category: "A", price: 300, stock: true },
    ];

    for (const data of testData) {
      const doc = await client.add(testCollection, data);
      createdIds.push({ collection: testCollection, id: doc.id });
    }

    // 単一条件のフィルタリングテストのみに絞る
    console.log("単一条件フィルタリングテスト開始");
    try {
      const filteredResults = await client
        .collection(testCollection)
        .where("category", "==", "A")
        .get();

      console.log("フィルタリング結果:", filteredResults.docs.length);
      expect(filteredResults.docs.length).toBe(2);
      expect(
        filteredResults.docs.every(doc => doc.data()?.category === "A")
      ).toBe(true);
    } catch (error) {
      console.error("フィルタリングテスト失敗:", error);
      throw error;
    }
  });

  // 複数フィルタのテスト
  it("複数のフィルタ条件を組み合わせたクエリが実行できること", async () => {
    // 固定のインデックス付きコレクションを使用
    const indexedCollection = INDEXED_TEST_COLLECTION;

    // テストデータを複数追加
    const testData = [
      { category: "A", price: 100, stock: true, tags: ["sale", "new"] },
      { category: "B", price: 200, stock: false, tags: ["sale"] },
      { category: "A", price: 300, stock: true, tags: ["premium"] },
      { category: "C", price: 150, stock: true, tags: ["sale", "limited"] },
      { category: "A", price: 50, stock: false, tags: ["clearance"] },
    ];

    for (const data of testData) {
      const doc = await client.add(indexedCollection, data);
      createdIds.push({ collection: indexedCollection, id: doc.id });
    }

    console.log("複数フィルタテスト開始");
    try {
      // カテゴリAかつ在庫あり
      const filteredResults1 = await client
        .collection(indexedCollection)
        .where("category", "==", "A")
        .where("stock", "==", true)
        .get();

      console.log("カテゴリAかつ在庫ありの結果:", filteredResults1.docs.length);
      expect(filteredResults1.docs.length).toBe(2);
      filteredResults1.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.category).toBe("A");
        expect(data?.stock).toBe(true);
      });

      // 価格が100より大きいかつ在庫あり
      const filteredResults2 = await client
        .collection(indexedCollection)
        .where("price", ">", 100)
        .where("stock", "==", true)
        .get();

      console.log("価格>100かつ在庫ありの結果:", filteredResults2.docs.length);
      expect(filteredResults2.docs.length).toBe(2);
      filteredResults2.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.price).toBeGreaterThan(100);
        expect(data?.stock).toBe(true);
      });

      // カテゴリAかつ価格が100以下
      const filteredResults3 = await client
        .collection(indexedCollection)
        .where("category", "==", "A")
        .where("price", "<=", 100)
        .get();

      console.log(
        "カテゴリAかつ価格<=100の結果:",
        filteredResults3.docs.length
      );
      expect(filteredResults3.docs.length).toBe(2);
      filteredResults3.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.category).toBe("A");
        expect(data?.price).toBeLessThanOrEqual(100);
      });

      // タグに'sale'を含むドキュメント
      const filteredResults4 = await client
        .collection(indexedCollection)
        .where("tags", "array-contains", "sale")
        .get();

      console.log("タグにsaleを含む結果:", filteredResults4.docs.length);
      expect(filteredResults4.docs.length).toBe(3);
      filteredResults4.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.tags).toContain("sale");
      });

      // カテゴリAかつタグに'sale'を含むドキュメント
      const filteredResults5 = await client
        .collection(indexedCollection)
        .where("category", "==", "A")
        .where("tags", "array-contains", "sale")
        .get();

      console.log(
        "カテゴリAかつタグにsaleを含む結果:",
        filteredResults5.docs.length
      );
      expect(filteredResults5.docs.length).toBe(1);
      filteredResults5.docs.forEach(doc => {
        const data = doc.data();
        expect(data?.category).toBe("A");
        expect(data?.tags).toContain("sale");
      });

      // カテゴリが'A'または'B'のドキュメント (in演算子)
      const filteredResults6 = await client
        .collection(indexedCollection)
        .where("category", "in", ["A", "B"])
        .get();

      console.log("カテゴリがAまたはBの結果:", filteredResults6.docs.length);
      expect(filteredResults6.docs.length).toBe(4);
      filteredResults6.docs.forEach(doc => {
        const data = doc.data();
        expect(["A", "B"]).toContain(data?.category);
      });

      // カテゴリが'A'または'B'ではないドキュメント (not-in演算子)
      const filteredResults7 = await client
        .collection(indexedCollection)
        .where("category", "not-in", ["A", "B"])
        .get();

      console.log(
        "カテゴリがAまたはBでない結果:",
        filteredResults7.docs.length
      );
      expect(filteredResults7.docs.length).toBe(1);
      filteredResults7.docs.forEach(doc => {
        const data = doc.data();
        expect(["A", "B"]).not.toContain(data?.category);
      });
    } catch (error) {
      console.error("複数フィルタテスト失敗:", error);
      throw error;
    }
  });

  // ネストしたコレクションのテスト
  it("ネストしたコレクションでのドキュメント操作ができること", async () => {
    // 親ドキュメント作成
    const parentData = { name: "親ドキュメント" };
    const parentDoc = await client.add(testCollection, parentData);
    createdIds.push({ collection: testCollection, id: parentDoc.id });

    // サブコレクションのリファレンス取得
    const subCollectionRef = client.collection(
      `${testCollection}/${parentDoc.id}/${NESTED_COLLECTION_NAME}`
    );

    // サブコレクションにデータ追加
    const subCollectionData = [
      { name: "サブアイテム1", value: 100 },
      { name: "サブアイテム2", value: 200 },
      { name: "サブアイテム3", value: 300 },
    ];

    // サブコレクションにドキュメント追加
    const subDocRefs: DocumentReference[] = [];
    for (const data of subCollectionData) {
      const subDoc = await subCollectionRef.add(data);
      subDocRefs.push(subDoc);
      const nestedPath = `${testCollection}/${parentDoc.id}/${NESTED_COLLECTION_NAME}`;
      createdIds.push({ collection: nestedPath, id: subDoc.id });
    }

    // サブコレクションからデータ取得
    const subCollectionSnapshot = await subCollectionRef.get();
    expect(subCollectionSnapshot.docs.length).toBe(3);

    // サブコレクションの特定ドキュメント取得
    const subDocSnapshot = await subDocRefs[0].get();
    expect(subDocSnapshot.exists).toBe(true);
    expect(subDocSnapshot.data()?.name).toBe("サブアイテム1");

    // サブコレクションのクエリテスト
    const querySnapshot = await subCollectionRef.where("value", ">", 150).get();

    expect(querySnapshot.docs.length).toBe(2);
    querySnapshot.docs.forEach(doc => {
      expect(doc.data()?.value).toBeGreaterThan(150);
    });

    // サブドキュメントの更新
    await subDocRefs[0].update({ value: 150 });
    const updatedSubDoc = await subDocRefs[0].get();
    expect(updatedSubDoc.data()?.value).toBe(150);

    // サブドキュメントの削除とクリーンアップリストからの削除
    const subDocIdToDelete = subDocRefs[2].id;
    const nestedPathToDelete = `${testCollection}/${parentDoc.id}/${NESTED_COLLECTION_NAME}`;
    await subDocRefs[2].delete();

    // 削除確認
    const deletedDocSnapshot = await client.get(
      nestedPathToDelete,
      subDocIdToDelete
    );
    expect(deletedDocSnapshot).toBeNull();

    // クリーンアップリストから削除したドキュメントを除外
    createdIds = createdIds.filter(
      doc =>
        !(doc.collection === nestedPathToDelete && doc.id === subDocIdToDelete)
    );
  });

  // コレクショングループのテスト
  it("コレクショングループでの横断的なクエリができること", async () => {
    // 親コレクション1
    const parentCollection1 = `${getTestCollectionName()}_parent1`;

    // 親コレクション2
    const parentCollection2 = `${getTestCollectionName()}_parent2`;

    // 親ドキュメント1に作成
    const parent1Data = { name: "親ドキュメント1" };
    const parent1Doc = await client.add(parentCollection1, parent1Data);
    createdIds.push({ collection: parentCollection1, id: parent1Doc.id });

    // 親ドキュメント2を作成
    const parent2Data = { name: "親ドキュメント2" };
    const parent2Doc = await client.add(parentCollection2, parent2Data);
    createdIds.push({ collection: parentCollection2, id: parent2Doc.id });

    // 親1のサブコレクションにデータ追加
    const subColl1Ref = client.collection(
      `${parentCollection1}/${parent1Doc.id}/${NESTED_COLLECTION_NAME}`
    );
    const subColl1Data = [
      { category: "A", price: 100 },
      { category: "B", price: 200 },
    ];

    for (const data of subColl1Data) {
      const doc = await subColl1Ref.add(data);
      const path = `${parentCollection1}/${parent1Doc.id}/${NESTED_COLLECTION_NAME}`;
      createdIds.push({ collection: path, id: doc.id });
    }

    // 親2のサブコレクションにデータ追加
    const subColl2Ref = client.collection(
      `${parentCollection2}/${parent2Doc.id}/${NESTED_COLLECTION_NAME}`
    );
    const subColl2Data = [
      { category: "A", price: 300 },
      { category: "C", price: 400 },
    ];

    for (const data of subColl2Data) {
      const doc = await subColl2Ref.add(data);
      const path = `${parentCollection2}/${parent2Doc.id}/${NESTED_COLLECTION_NAME}`;
      createdIds.push({ collection: path, id: doc.id });
    }

    // コレクショングループで全サブコレクションからクエリを実行
    console.log("コレクショングループテスト開始");
    try {
      // 全 "items" コレクションからカテゴリAのアイテムを検索
      const groupQuery = await client
        .collectionGroup(NESTED_COLLECTION_NAME)
        .where("category", "==", "A")
        .get();

      console.log("コレクショングループクエリ結果:", groupQuery.docs.length);
      expect(groupQuery.docs.length).toBe(2);

      // すべての結果がカテゴリAであることを確認
      groupQuery.docs.forEach(doc => {
        expect(doc.data()?.category).toBe("A");
      });

      // プライス順にソートされたクエリ
      const sortedQuery = await client
        .collectionGroup(NESTED_COLLECTION_NAME)
        .orderBy("price", "desc")
        .get();

      console.log("ソート結果:", sortedQuery.docs.length);
      expect(sortedQuery.docs.length).toBe(4);

      // 降順に並んでいることを確認
      let lastPrice = Infinity;
      sortedQuery.docs.forEach(doc => {
        const currentPrice = doc.data()?.price;
        expect(currentPrice).toBeLessThanOrEqual(lastPrice);
        lastPrice = currentPrice;
      });

      // 複合条件のクエリ
      const complexQuery = await client
        .collectionGroup(NESTED_COLLECTION_NAME)
        .where("category", "in", ["A", "B"])
        .where("price", ">", 150)
        .get();

      console.log("複合条件結果:", complexQuery.docs.length);
      expect(complexQuery.docs.length).toBe(2);

      complexQuery.docs.forEach(doc => {
        const data = doc.data();
        expect(["A", "B"]).toContain(data?.category);
        expect(data?.price).toBeGreaterThan(150);
      });
    } catch (error) {
      console.error("コレクショングループテスト失敗:", error);
      throw error;
    }
  });
});
