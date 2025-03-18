# Firebase REST Firestore

Firebase Firestore REST API client for Edge runtime environments like Cloudflare Workers and Vercel Edge Functions.

## Features

- Works in Edge runtime environments where Firebase Admin SDK is not available
- Full CRUD operations support
- TypeScript support
- Token caching for better performance
- Simple and intuitive API
- Explicit configuration without hidden environment variable dependencies
- Firebase Admin SDK compatible interface (v0.2.0+)
- Lazy configuration validation for Next.js compatibility (v0.2.1+)

## Installation

```bash
npm install firebase-rest-firestore
```

## Usage

### Basic usage with explicit configuration

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// Create a client with your configuration
const firestore = createFirestoreClient({
  projectId: "your-project-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
});

// Create a document
const game = await firestore.create("games", {
  name: "New Game",
  createdAt: new Date(),
  score: 100,
  active: true,
});
console.log("Created game ID:", game.id);

// Get a document
const fetchedGame = await firestore.get("games", game.id);
console.log("Fetched game:", fetchedGame);

// Update a document
const updatedGame = await firestore.update("games", game.id, {
  ...fetchedGame,
  name: "Updated Game Name",
  updatedAt: new Date(),
});

// Query documents
const userGames = await firestore.query("games", {
  where: [{ field: "score", op: "GREATER_THAN", value: 50 }],
  orderBy: "createdAt",
  limit: 10,
});
console.log("Games with score > 50:", userGames);

// Delete a document
await firestore.delete("games", game.id);
```

### Firebase Admin SDK Compatible Interface (v0.2.0+)

From version 0.2.0, firebase-rest-firestore provides a Firebase Admin SDK compatible interface:

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// Create a client with your configuration
const firestore = createFirestoreClient({
  projectId: "your-project-id",
  privateKey: "your-private-key",
  clientEmail: "your-client-email",
});

// Create a document with auto-generated ID
const gameRef = firestore.collection("games").doc();
await gameRef.set({
  name: "New Game",
  createdAt: new Date(),
  score: 100,
  active: true,
});
console.log("Created game ID:", gameRef.id);

// Create a document with specific ID
await firestore.collection("games").doc("game123").set({
  name: "Specific Game",
  createdAt: new Date(),
});

// Get a document
const gameDoc = await firestore.doc("games/game123").get();
if (gameDoc.exists) {
  console.log("Fetched game:", gameDoc.data());
}

// Update a document
await firestore.collection("games").doc("game123").update({
  name: "Updated Game Name",
  updatedAt: new Date(),
});

// Query documents
const querySnapshot = await firestore
  .collection("games")
  .where("score", ">", 50)
  .where("active", "==", true)
  .orderBy("score", "desc")
  .limit(10)
  .get();

// Process query results
const games = [];
querySnapshot.forEach(doc => {
  games.push({
    id: doc.id,
    ...doc.data(),
  });
});
console.log("Games with score > 50:", games);

// Delete a document
await firestore.collection("games").doc("game123").delete();

// Working with subcollections
const commentRef = firestore
  .collection("games")
  .doc("game123")
  .collection("comments")
  .doc();

await commentRef.set({
  text: "Great game!",
  createdAt: new Date(),
});
```

## Configuration

The `FirestoreConfig` object requires the following properties:

| Property    | Description                  |
| ----------- | ---------------------------- |
| projectId   | Firebase project ID          |
| privateKey  | Service account private key  |
| clientEmail | Service account client email |

## API Reference

### FirestoreClient

The main class for interacting with Firestore.

#### create(collectionName, data)

Creates a new document in the specified collection.

#### get(collectionName, documentId)

Retrieves a document by ID.

#### update(collectionName, documentId, data)

Updates an existing document.

#### delete(collectionName, documentId)

Deletes a document.

#### query(collectionName, options)

Queries documents in a collection with filtering, ordering, and pagination.

### createFirestoreClient(config)

Creates a new FirestoreClient instance with the provided configuration.

### loadConfigFromEnv()

Helper function to load configuration from environment variables.

## Error Handling

Firebase REST Firestore throws exceptions with appropriate error messages when API requests fail. Here's an example of error handling:

```typescript
try {
  // Try to get a document
  const game = await firestore.get("games", "non-existent-id");

  // If document doesn't exist, null is returned
  if (game === null) {
    console.log("Document not found");
    return;
  }

  // Process document if it exists
  console.log("Fetched game:", game);
} catch (error) {
  // Handle API errors (authentication, network, etc.)
  console.error("Firestore error:", error.message);
}
```

Common error cases:

- Authentication errors (invalid credentials)
- Network errors
- Invalid query parameters
- Firestore rate limits

## Query Options Details

The `query` method supports the following options for filtering, sorting, and paginating Firestore documents:

### where

Specify multiple filter conditions. Each condition is an object with the following properties:

- `field`: The field name to filter on
- `op`: The comparison operator. Available values:
  - `EQUAL`: Equal to
  - `NOT_EQUAL`: Not equal to
  - `LESS_THAN`: Less than
  - `LESS_THAN_OR_EQUAL`: Less than or equal to
  - `GREATER_THAN`: Greater than
  - `GREATER_THAN_OR_EQUAL`: Greater than or equal to
  - `ARRAY_CONTAINS`: Array contains
  - `IN`: Equal to any of the specified values
  - `ARRAY_CONTAINS_ANY`: Array contains any of the specified values
  - `NOT_IN`: Not equal to any of the specified values
- `value`: The value to compare against

```typescript
// Query games with score > 50 and active = true
const games = await firestore.query("games", {
  where: [
    { field: "score", op: "GREATER_THAN", value: 50 },
    { field: "active", op: "EQUAL", value: true },
  ],
});
```

### orderBy

Specifies the field name to sort results by. Results are sorted in ascending order by default.

```typescript
// Sort by creation time
const games = await firestore.query("games", {
  orderBy: "createdAt",
});
```

### limit

Limits the maximum number of results returned.

```typescript
// Get at most 10 documents
const games = await firestore.query("games", {
  limit: 10,
});
```

### offset

Specifies the number of results to skip. Useful for pagination.

```typescript
// Skip the first 20 results and get the next 10
const games = await firestore.query("games", {
  offset: 20,
  limit: 10,
});
```

Example of a compound query:

```typescript
// Get top 10 active games by score
const topGames = await firestore.query("games", {
  where: [{ field: "active", op: "EQUAL", value: true }],
  orderBy: "score", // Sort by score
  limit: 10,
});
```

## Edge Runtime Examples

### Cloudflare Workers

```typescript
// Set these environment variables in wrangler.toml
// FIREBASE_PROJECT_ID
// FIREBASE_PRIVATE_KEY
// FIREBASE_CLIENT_EMAIL

import { createFirestoreClient } from "firebase-rest-firestore";

export default {
  async fetch(request, env, ctx) {
    // Load configuration from environment variables
    const firestore = createFirestoreClient({
      projectId: env.FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    });

    const url = new URL(request.url);
    const path = url.pathname;

    // Example API endpoint
    if (path === "/api/games" && request.method === "GET") {
      try {
        // Get active games
        const games = await firestore.query("games", {
          where: [{ field: "active", op: "EQUAL", value: true }],
          limit: 10,
        });

        return new Response(JSON.stringify(games), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
```

### Vercel Edge Functions

```typescript
// Set these environment variables in .env.local
// FIREBASE_PROJECT_ID
// FIREBASE_PRIVATE_KEY
// FIREBASE_CLIENT_EMAIL

import { createFirestoreClient } from "firebase-rest-firestore";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  // Load configuration from environment variables
  const firestore = createFirestoreClient({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });

  try {
    // Get the latest 10 documents
    const documents = await firestore.query("posts", {
      orderBy: "createdAt",
      limit: 10,
    });

    return new Response(JSON.stringify(documents), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

## Performance Considerations

### Token Caching

Firebase REST Firestore caches JWT tokens to improve performance. By default, tokens are cached for 50 minutes (actual token expiry is 1 hour). This eliminates the need to generate a new token for each request, improving API request speed.

```typescript
// Tokens are cached internally, so multiple requests
// have minimal authentication overhead
const doc1 = await firestore.get("collection", "doc1");
const doc2 = await firestore.get("collection", "doc2");
const doc3 = await firestore.get("collection", "doc3");
```

### Query Optimization

When dealing with large amounts of data, consider the following:

1. **Set appropriate limits**: Always use the `limit` parameter to restrict the number of documents returned.

2. **Query only needed fields**: Future versions will add support for retrieving only specific fields.

3. **Create indexes**: For complex queries, create appropriate indexes in the Firebase console.

4. **Use pagination**: When retrieving large datasets, implement pagination using `offset` and `limit`.

### Edge Environment Considerations

In edge environments, be aware of:

1. **Cold starts**: Initial execution has token generation overhead.

2. **Memory usage**: Be mindful of memory limits when processing large amounts of data.

3. **Timeouts**: Long-running queries may hit edge environment timeout limits.

## Limitations and Roadmap

### Current Limitations

- **Batch operations**: The current version does not support batch processing for operating on multiple documents at once.
- **Transactions**: Atomic transaction operations are not supported.
- **Real-time listeners**: Due to the nature of REST APIs, real-time data synchronization is not supported.
- **Subcollections**: The current version has limited direct support for nested subcollections.

### Future Roadmap

The following features are planned for future versions:

- Batch operations support
- Basic transaction support
- Improved subcollection support
- More detailed query options (compound indexes, etc.)
- Performance optimizations

Please report feature requests and bugs via GitHub Issues.

## License

MIT

---

# Firebase REST Firestore (日本語ドキュメント)

Firebase Firestore REST API クライアントは、Cloudflare Workers や Vercel Edge Functions などのエッジランタイム環境向けに設計されています。

## 特徴

- Firebase Admin SDK が利用できないエッジランタイム環境で動作
- 完全な CRUD 操作のサポート
- TypeScript サポート
- パフォーマンス向上のためのトークンキャッシュ
- シンプルで直感的な API
- 環境変数に依存しない明示的な設定
- Firebase Admin SDK compatible interface (v0.2.0+)
- Next.js 互換性のための遅延設定検証 (v0.2.1+)

## インストール

```bash
npm install firebase-rest-firestore
```

## 使い方

### 基本的な使い方（明示的な設定）

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// 設定を指定してクライアントを作成
const firestore = createFirestoreClient({
  projectId: "あなたのプロジェクトID",
  privateKey: "サービスアカウントの秘密鍵",
  clientEmail: "サービスアカウントのメールアドレス",
});

// ドキュメントの作成
const game = await firestore.create("games", {
  name: "新しいゲーム",
  createdAt: new Date(),
  score: 100,
  active: true,
});
console.log("作成されたゲームID:", game.id);

// ドキュメントの取得
const fetchedGame = await firestore.get("games", game.id);
console.log("取得したゲーム:", fetchedGame);

// ドキュメントの更新
const updatedGame = await firestore.update("games", game.id, {
  ...fetchedGame,
  name: "更新されたゲーム名",
  updatedAt: new Date(),
});

// ドキュメントのクエリ
const userGames = await firestore.query("games", {
  where: [{ field: "score", op: "GREATER_THAN", value: 50 }],
  orderBy: "createdAt",
  limit: 10,
});
console.log("スコアが50より大きいゲーム:", userGames);

// ドキュメントの削除
await firestore.delete("games", game.id);
```

### Firebase Admin SDK 互換インターフェース (v0.2.0+)

バージョン 0.2.0 から、firebase-rest-firestore は Firebase Admin SDK と互換性のあるインターフェースを提供しています：

```typescript
import { createFirestoreClient } from "firebase-rest-firestore";

// 設定を指定してクライアントを作成
const firestore = createFirestoreClient({
  projectId: "あなたのプロジェクトID",
  privateKey: "サービスアカウントの秘密鍵",
  clientEmail: "サービスアカウントのメールアドレス",
});

// 自動生成IDでドキュメントを作成
const gameRef = firestore.collection("games").doc();
await gameRef.set({
  name: "新しいゲーム",
  createdAt: new Date(),
  score: 100,
  active: true,
});
console.log("作成されたゲームID:", gameRef.id);

// 特定のIDでドキュメントを作成
await firestore.collection("games").doc("game123").set({
  name: "特定のゲーム",
  createdAt: new Date(),
});

// ドキュメントの取得
const gameDoc = await firestore.doc("games/game123").get();
if (gameDoc.exists) {
  console.log("取得したゲーム:", gameDoc.data());
}

// ドキュメントの更新
await firestore.collection("games").doc("game123").update({
  name: "更新されたゲーム名",
  updatedAt: new Date(),
});

// ドキュメントのクエリ
const querySnapshot = await firestore
  .collection("games")
  .where("score", ">", 50)
  .where("active", "==", true)
  .orderBy("score", "desc")
  .limit(10)
  .get();

// クエリ結果の処理
const games = [];
querySnapshot.forEach(doc => {
  games.push({
    id: doc.id,
    ...doc.data(),
  });
});
console.log("スコアが50より大きいゲーム:", games);

// ドキュメントの削除
await firestore.collection("games").doc("game123").delete();

// サブコレクションの操作
const commentRef = firestore
  .collection("games")
  .doc("game123")
  .collection("comments")
  .doc();

await commentRef.set({
  text: "素晴らしいゲーム！",
  createdAt: new Date(),
});
```

## 設定

`FirestoreConfig`オブジェクトには以下のプロパティが必要です：

| プロパティ  | 説明                               |
| ----------- | ---------------------------------- |
| projectId   | Firebase プロジェクト ID           |
| privateKey  | サービスアカウントの秘密鍵         |
| clientEmail | サービスアカウントのメールアドレス |

## API リファレンス

### FirestoreClient

Firestore と対話するためのメインクラスです。

#### create(collectionName, data)

指定されたコレクションに新しいドキュメントを作成します。

#### get(collectionName, documentId)

ID によってドキュメントを取得します。

#### update(collectionName, documentId, data)

既存のドキュメントを更新します。

#### delete(collectionName, documentId)

ドキュメントを削除します。

#### query(collectionName, options)

フィルタリング、並べ替え、ページネーションを使用してコレクション内のドキュメントをクエリします。

### createFirestoreClient(config)

提供された設定で新しい FirestoreClient インスタンスを作成します。

### loadConfigFromEnv()

環境変数から設定を読み込むためのヘルパー関数です。

## エラーハンドリング

Firebase REST Firestore は、API リクエスト中にエラーが発生した場合、適切なエラーメッセージを含む例外をスローします。以下はエラーハンドリングの例です：

```typescript
try {
  // ドキュメントの取得を試みる
  const game = await firestore.get("games", "non-existent-id");

  // ドキュメントが存在しない場合はnullが返される
  if (game === null) {
    console.log("ドキュメントが見つかりませんでした");
    return;
  }

  // ドキュメントが存在する場合の処理
  console.log("取得したゲーム:", game);
} catch (error) {
  // API呼び出し中のエラー（認証エラーやネットワークエラーなど）
  console.error("Firestoreエラー:", error.message);
}
```

一般的なエラーケース：

- 認証エラー（無効なクレデンシャル）
- ネットワークエラー
- 無効なクエリパラメータ
- Firestore のレート制限

## クエリオプションの詳細

`query`メソッドでは、以下のオプションを使用して Firestore のドキュメントをフィルタリング、ソート、ページネーションできます：

### where

複数のフィルター条件を指定できます。各条件は以下のプロパティを持つオブジェクトです：

- `field`: フィルタリングするフィールド名
- `op`: 比較演算子。以下の値が使用可能です：
  - `EQUAL`: 等しい
  - `NOT_EQUAL`: 等しくない
  - `LESS_THAN`: より小さい
  - `LESS_THAN_OR_EQUAL`: 以下
  - `GREATER_THAN`: より大きい
  - `GREATER_THAN_OR_EQUAL`: 以上
  - `ARRAY_CONTAINS`: 配列に含まれる
  - `IN`: 指定した値のいずれかに等しい
  - `ARRAY_CONTAINS_ANY`: 配列が指定した値のいずれかを含む
  - `NOT_IN`: 指定した値のいずれにも等しくない
- `value`: 比較する値

```typescript
// スコアが50より大きく、activeがtrueのゲームを検索
const games = await firestore.query("games", {
  where: [
    { field: "score", op: "GREATER_THAN", value: 50 },
    { field: "active", op: "EQUAL", value: true },
  ],
});
```

### orderBy

結果を並べ替えるフィールド名を指定します。デフォルトでは昇順（ASCENDING）でソートされます。

```typescript
// 作成日時で並べ替え
const games = await firestore.query("games", {
  orderBy: "createdAt",
});
```

### limit

返される結果の最大数を指定します。

```typescript
// 最大10件のドキュメントを取得
const games = await firestore.query("games", {
  limit: 10,
});
```

### offset

結果のスキップ数を指定します。ページネーションに使用できます。

```typescript
// 最初の20件をスキップして、次の10件を取得
const games = await firestore.query("games", {
  offset: 20,
  limit: 10,
});
```

複合クエリの例：

```typescript
// アクティブなゲームをスコアの高い順に10件取得
const topGames = await firestore.query("games", {
  where: [{ field: "active", op: "EQUAL", value: true }],
  orderBy: "score", // スコアでソート
  limit: 10,
});
```

## エッジランタイムでの使用例

### Cloudflare Workers

```typescript
// wrangler.toml に以下の環境変数を設定してください
// FIREBASE_PROJECT_ID
// FIREBASE_PRIVATE_KEY
// FIREBASE_CLIENT_EMAIL

import { createFirestoreClient } from "firebase-rest-firestore";

export default {
  async fetch(request, env, ctx) {
    // 環境変数から設定を読み込む
    const firestore = createFirestoreClient({
      projectId: env.FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    });

    const url = new URL(request.url);
    const path = url.pathname;

    // APIエンドポイントの例
    if (path === "/api/games" && request.method === "GET") {
      try {
        // アクティブなゲームを取得
        const games = await firestore.query("games", {
          where: [{ field: "active", op: "EQUAL", value: true }],
          limit: 10,
        });

        return new Response(JSON.stringify(games), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
```

### Vercel Edge Functions

```typescript
// .env.local に以下の環境変数を設定してください
// FIREBASE_PROJECT_ID
// FIREBASE_PRIVATE_KEY
// FIREBASE_CLIENT_EMAIL

import { createFirestoreClient } from "firebase-rest-firestore";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  // 環境変数から設定を読み込む
  const firestore = createFirestoreClient({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });

  try {
    // 最新の10件のドキュメントを取得
    const documents = await firestore.query("posts", {
      orderBy: "createdAt",
      limit: 10,
    });

    return new Response(JSON.stringify(documents), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

## パフォーマンスに関する注意点

### トークンキャッシュ

Firebase REST Firestore は、パフォーマンスを向上させるために JWT トークンをキャッシュします。デフォルトでは、トークンは 50 分間キャッシュされます（実際のトークン有効期限は 1 時間）。これにより、リクエストごとに新しいトークンを生成する必要がなくなり、API リクエストの速度が向上します。

```typescript
// トークンは内部的にキャッシュされるため、
// 複数のリクエストでも認証のオーバーヘッドは最小限に抑えられます
const doc1 = await firestore.get("collection", "doc1");
const doc2 = await firestore.get("collection", "doc2");
const doc3 = await firestore.get("collection", "doc3");
```

### クエリの最適化

大量のデータを扱う場合は、以下の点に注意してください：

1. **適切な制限を設定する**: 常に`limit`パラメータを使用して、返されるドキュメント数を制限してください。

2. **必要なフィールドのみをクエリする**: 将来のバージョンでは、特定のフィールドのみを取得する機能が追加される予定です。

3. **インデックスの作成**: 複雑なクエリを実行する場合は、Firebase コンソールで適切なインデックスを作成してください。

4. **ページネーションの使用**: 大量のデータを取得する場合は、`offset`と`limit`を組み合わせてページネーションを実装してください。

### エッジ環境での注意点

エッジ環境では、以下の点に注意してください：

1. **コールドスタート**: 初回実行時にはトークン生成のオーバーヘッドがあります。

2. **メモリ使用量**: 大量のデータを一度に処理する場合は、メモリ制限に注意してください。

3. **タイムアウト**: 長時間実行されるクエリは、エッジ環境のタイムアウト制限に達する可能性があります。

## 制限事項とロードマップ

### 現在の制限事項

- **バッチ操作**: 現在のバージョンでは、複数のドキュメントを一度に操作するバッチ処理はサポートされていません。
- **トランザクション**: 原子的なトランザクション操作はサポートされていません。
- **リアルタイムリスナー**: REST API の性質上、リアルタイムのデータ同期はサポートされていません。
- **サブコレクション**: 現在のバージョンでは、ネストされたサブコレクションの直接的なサポートは限定的です。

### 将来のロードマップ

以下の機能は将来のバージョンで実装予定です：

- バッチ操作のサポート
- 基本的なトランザクションのサポート
- サブコレクションの改善されたサポート
- より詳細なクエリオプション（複合インデックスなど）
- パフォーマンス最適化

機能リクエストやバグ報告は、GitHub の Issue でお知らせください。

## ライセンス

MIT
