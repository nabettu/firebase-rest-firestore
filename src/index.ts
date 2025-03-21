// 型定義のエクスポート
export * from "./types";

// クライアントのエクスポート
import {
  FirestoreClient,
  createFirestoreClient,
  CollectionReference,
  DocumentReference,
  CollectionGroup,
  Query,
  QuerySnapshot,
  DocumentSnapshot,
  WriteResult,
} from "./client";

// ユーティリティ関数のエクスポート
export { getFirestoreToken } from "./utils/auth";
export {
  convertToFirestoreValue,
  convertFromFirestoreValue,
  convertToFirestoreDocument,
  convertFromFirestoreDocument,
} from "./utils/converter";
export { getFirestoreBasePath, getDocumentId } from "./utils/path";
export { formatPrivateKey, formatConfig } from "./utils/config";

// クライアント関連のエクスポート
export {
  FirestoreClient,
  createFirestoreClient,
  CollectionReference,
  DocumentReference,
  CollectionGroup,
  Query,
  QuerySnapshot,
  DocumentSnapshot,
  WriteResult,
};
