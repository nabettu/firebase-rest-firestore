import { FirestoreConfig } from "../src/types";
import { formatPrivateKey } from "../src/utils/config";

/**
 * 環境変数から設定を読み込む
 * @returns Firestore設定オブジェクト
 */
export function loadConfig(): FirestoreConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "必要な環境変数が設定されていません。.envファイルを確認してください。"
    );
  }

  // 秘密鍵に含まれる可能性のある改行エスケープシーケンスを実際の改行に変換
  privateKey = formatPrivateKey(privateKey);

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

/**
 * テスト用のコレクション名を生成
 * @param prefix コレクション名のプレフィックス
 * @returns ユニークなコレクション名
 */
export function getTestCollectionName(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * テストデータのクリーンアップ処理
 * @param client FirestoreClient
 * @param collectionName コレクション名
 * @param docIds ドキュメントIDの配列
 */
export async function cleanupTestData(
  client: any,
  collectionName: string,
  docIds: string[]
): Promise<void> {
  for (const id of docIds) {
    try {
      await client.delete(collectionName, id);
    } catch (err) {
      console.error(`Clean up failed for document ${id}: ${err}`);
    }
  }
}
