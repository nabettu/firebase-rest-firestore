import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FirestoreClient, createFirestoreClient } from "../src/client";
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

describe("Firebase Rest Firestore", () => {
  let client: FirestoreClient;
  let testCollection: string;
  let createdIds: string[] = [];

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
    for (const id of createdIds) {
      try {
        await client.delete(testCollection, id);
      } catch (err) {
        console.error(`Clean up failed for document ${id}: ${err}`);
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

    const createdDoc = await client.create(testCollection, testData);
    createdIds.push(createdDoc.id);

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
      value: 456,
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
    expect(updatedDoc.value).toBe(updateData.value);
    expect(updatedDoc.active).toBe(updateData.active);

    // 更新確認テスト
    const fetchedUpdatedDoc = await client.get(testCollection, createdDoc.id);
    expect(fetchedUpdatedDoc?.name).toBe(updateData.name);
    expect(fetchedUpdatedDoc?.value).toBe(updateData.value);
    expect(fetchedUpdatedDoc?.active).toBe(updateData.active);

    // 削除テスト
    await client.delete(testCollection, createdDoc.id);
    const deletedDoc = await client.get(testCollection, createdDoc.id);
    expect(deletedDoc).toBeNull();

    // 削除済みのIDはクリーンアップ不要
    createdIds = createdIds.filter(id => id !== createdDoc.id);
  });

  // リファレンスAPIテスト
  it("リファレンスAPIでのドキュメント操作ができること", async () => {
    // コレクションリファレンス
    const collRef = client.collection(testCollection);
    expect(collRef).toBeDefined();

    // ドキュメント追加
    const testData = { name: "リファレンステスト", count: 100 };
    const docRef = await collRef.add(testData);
    createdIds.push(docRef.id);

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
    createdIds = createdIds.filter(id => id !== docRef.id);
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
      const doc = await client.create(testCollection, data);
      createdIds.push(doc.id);
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

    const createdIndexedIds: string[] = [];

    for (const data of testData) {
      const doc = await client.create(indexedCollection, data);
      createdIndexedIds.push(doc.id);
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
    } finally {
      // テスト後にクリーンアップ
      for (const id of createdIndexedIds) {
        try {
          await client.delete(indexedCollection, id);
        } catch (err) {
          console.error(`Clean up failed for indexed document ${id}: ${err}`);
        }
      }
    }
  });
});
