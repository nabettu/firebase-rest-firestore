// 型定義のエクスポート
export * from "./types";

// クライアントのエクスポート
import { FirestoreClient, createFirestoreClient } from "./client";

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
