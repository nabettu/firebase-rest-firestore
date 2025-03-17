// 型定義のエクスポート
export * from "./types";

// クライアントのエクスポート
import { FirestoreClient, createFirestoreClient } from "./client";
import { FirestoreConfig } from "./types";

/**
 * 環境変数からFirestore設定を読み込むヘルパー関数
 * @returns 環境変数から読み込んだFirestore設定
 * @throws 必要な環境変数が設定されていない場合にエラーをスロー
 */
export function loadConfigFromEnv(): FirestoreConfig {
  const config = {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID || "",
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
    clientId: process.env.FIREBASE_CLIENT_ID || "",
    clientCertUrl: process.env.FIREBASE_CLIENT_CERT_URL || "",
  };

  // 必須パラメータのチェック
  const requiredParams: Array<keyof FirestoreConfig> = [
    "projectId",
    "privateKeyId",
    "privateKey",
    "clientEmail",
    "clientId",
    "clientCertUrl",
  ];

  const missingParams = requiredParams.filter(param => !config[param]);
  if (missingParams.length > 0) {
    throw new Error(
      `必須の環境変数が設定されていません: ${missingParams
        .map(param => `FIREBASE_${param.toUpperCase()}`)
        .join(", ")}`
    );
  }

  return config;
}

// 後方互換性のための関数
export async function saveToFirestore(
  collectionName: string,
  data: Record<string, any>,
  client: FirestoreClient
) {
  const result = await client.create(collectionName, data);
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
