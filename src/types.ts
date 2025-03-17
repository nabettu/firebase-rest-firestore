/**
 * Firestoreクライアントの設定インターフェース
 */
export interface FirestoreConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

/**
 * Firestoreの値型定義
 */
export type FirestoreFieldValue =
  | { stringValue: string }
  | { integerValue: number }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields: Record<string, FirestoreFieldValue> } }
  | { arrayValue: { values: FirestoreFieldValue[] } };

/**
 * Firestoreドキュメント型
 */
export interface FirestoreDocument {
  name?: string;
  fields: Record<string, FirestoreFieldValue>;
  createTime?: string;
  updateTime?: string;
}

/**
 * Firestoreレスポンス型
 */
export interface FirestoreResponse {
  name: string;
  fields?: Record<string, FirestoreFieldValue>;
  createTime?: string;
  updateTime?: string;
}

/**
 * クエリオプション型
 */
export interface QueryOptions {
  where?: Array<{ field: string; op: string; value: any }>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}
