// 型定義のエクスポート
export * from "./types";

// クライアントのエクスポート
import { FirestoreClient, createFirestoreClient } from "./client";

// デフォルトのFirestoreクライアントインスタンス（環境変数から設定を取得）
export const firestore = new FirestoreClient();

// 後方互換性のための関数
export async function saveToFirestore(
  collectionName: string,
  data: Record<string, any>
) {
  const result = await firestore.create(collectionName, data);
  return { documentId: result.id, result };
}

// ユーティリティ関数のエクスポート
export { getFirestoreToken } from "./utils/auth";
export {
  convertToFirestoreValue,
  convertFromFirestoreValue,
  convertToFirestoreDocument,
  convertFromFirestoreDocument,
} from "./utils/converter";
export { getFirestoreBasePath, getDocumentId } from "./utils/path";

// クライアント関連のエクスポート
export { FirestoreClient, createFirestoreClient };
