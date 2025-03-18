# Firebase REST Firestore

Firebase Firestore REST API クライアント - Cloudflare Workers や Vercel Edge Functions などのエッジランタイム環境向け。

## 特徴

- Firebase Admin SDK が利用できないエッジランタイム環境で動作
- 完全な CRUD 操作のサポート
- TypeScript サポート
- パフォーマンス向上のためのトークンキャッシング
- シンプルで直感的な API
- 環境変数への暗黙的な依存がない明示的な設定

## インストール

```bash
npm install firebase-rest-firestore
```

## 使用方法

```typescript
import { initializeFirestore } from "firebase-rest-firestore";

// SDK互換クライアントを初期化
const db = initializeFirestore({
  projectId: "your-project-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
});

// コレクションリファレンスの取得
const gamesRef = db.collection("games");

// ドキュメントの追加
const gameRef = await gamesRef.add({
  name: "New Game",
  createdAt: new Date(),
  score: 100,
});

// ドキュメントの取得
const gameSnapshot = await gameRef.get();
console.log(gameSnapshot.data());

// ドキュメントの更新
await gameRef.update({
  score: 200,
});

// ドキュメントの削除
await gameRef.delete();

// クエリの実行
const highScoreGames = await gamesRef
  .where("score", ">", 150)
  .where("createdAt", "<", new Date())
  .get();

highScoreGames.forEach(doc => {
  console.log(doc.id, "=>", doc.data());
});
```

## API リファレンス

### createFirestoreClient(config)

Firestore クライアントを作成します。

#### パラメータ

- `config` (object): クライアント設定
  - `projectId` (string): Firebase プロジェクト ID
  - `privateKey` (string): サービスアカウントの秘密鍵
  - `clientEmail` (string): サービスアカウントのメールアドレス

#### 戻り値

以下のメソッドを持つ Firestore クライアントオブジェクト：

### collection(collectionPath).add(data)

コレクション内に自動生成された ID を持つ新しいドキュメントを作成します。

#### パラメータ

- `data` (object): ドキュメントデータ

#### 戻り値

作成されたドキュメントへの参照。

### collection(collectionPath).doc(id?).set(data)

指定された ID でドキュメントを作成または上書きします。ID が指定されていない場合は自動的に生成されます。

#### パラメータ

- `id` (string, オプション): ドキュメントの ID
- `data` (object): ドキュメントデータ

#### 戻り値

プロミス（作成または上書き操作の完了時に解決）。

### client.get(collection, id)

ドキュメントを取得します。

#### パラメータ

- `collection` (string): ドキュメントが属するコレクション名
- `id` (string): 取得するドキュメントの ID

#### 戻り値

ドキュメントデータを含むオブジェクト。ドキュメントが存在しない場合は null。

### client.update(collection, id, data)

既存のドキュメントを更新します。

#### パラメータ

- `collection` (string): ドキュメントが属するコレクション名
- `id` (string): 更新するドキュメントの ID
- `data` (object): 更新するフィールドを含むオブジェクト

#### 戻り値

更新されたドキュメントを表すオブジェクト。

### client.delete(collection, id)

ドキュメントを削除します。

#### パラメータ

- `collection` (string): ドキュメントが属するコレクション名
- `id` (string): 削除するドキュメントの ID

#### 戻り値

成功した場合は true。

### client.query(collection, filters, options?)

コレクションに対してクエリを実行します。

#### パラメータ

- `collection` (string): クエリするコレクション名
- `filters` (array): 各フィルタは[フィールド, 演算子, 値]の形式の配列
- `options` (object, オプション):
  - `orderBy` (array, オプション): 並べ替えの指定（例：[['score', 'desc'], ['createdAt', 'asc']]）
  - `limit` (number, オプション): 結果の最大数
  - `offset` (number, オプション): スキップする結果の数
  - `startAt` (any, オプション): この値から始まるドキュメントを返す
  - `startAfter` (any, オプション): この値の後に始まるドキュメントを返す
  - `endAt` (any, オプション): この値で終わるドキュメントを返す
  - `endBefore` (any, オプション): この値の前に終わるドキュメントを返す

#### 戻り値

クエリ条件に一致するドキュメントの配列。

## Next.js 環境での設定

Next.js アプリでは、サーバーサイドでのみ実行されるように設定してください：

```typescript
// Initialize in a server component or API route
import { createFirestoreClient } from "firebase-rest-firestore";

export async function getServerSideProps() {
  // Server-side only code
  const firestore = createFirestoreClient({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });

  const data = await firestore.query("collection", [
    /* your filters */
  ]);

  return {
    props: {
      data: JSON.parse(JSON.stringify(data)),
    },
  };
}
```

## Cloudflare Workers 環境での使用

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

export default {
  async fetch(request, env) {
    const firestore = createFirestoreClient({
      projectId: env.FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    });

    // APIロジックの実装...
    const data = await firestore.query("collection", [
      /* your filters */
    ]);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
```

## クイックスタート

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// 設定オブジェクトでクライアントを初期化
const firestore = createFirestoreClient({
  projectId: "your-project-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
});

// ドキュメントの追加
const newDoc = await firestore.add("collection", {
  name: "テストドキュメント",
  value: 100,
});

// ドキュメントの取得
const doc = await firestore.get("collection", newDoc.id);

// ドキュメントの更新
await firestore.update("collection", newDoc.id, { value: 200 });

// ドキュメントのクエリ
const querySnapshot = await firestore
  .collection("games")
  .where("score", ">", 50)
  .where("active", "==", true)
  .orderBy("score", "desc")
  .limit(10)
  .get();

const games = [];
querySnapshot.forEach(doc => {
  games.push({
    id: doc.id,
    ...doc.data(),
  });
});
console.log("Games with score > 50:", games);

// ドキュメントの削除
await firestore.delete("collection", newDoc.id);
```

## 設定

Firestore の権限を持つ Firebase サービスアカウントが必要です：

```typescript
createFirestoreClient({
  projectId: "your-project-id",
  privateKey: "your-private-key", // エスケープされた改行(\\n)を含む場合、自動的にフォーマットされます
  clientEmail: "your-client-email",
});
```

## API リファレンス

### add(collectionName, data)

コレクションに新しいドキュメントを追加します。

パラメータ:

- `collectionName`: コレクション名
- `data`: 追加するドキュメントデータ

戻り値: 自動生成された ID を持つ追加されたドキュメント。

## ライセンス

MIT
