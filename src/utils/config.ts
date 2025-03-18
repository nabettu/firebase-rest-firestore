import { FirestoreConfig } from "../types";

/**
 * 秘密鍵の文字列内にある改行コードのエスケープシーケンスを実際の改行に変換する
 * @param privateKey 変換する秘密鍵文字列
 * @returns 変換後の秘密鍵文字列
 */
export function formatPrivateKey(privateKey: string): string {
  if (privateKey.includes("\\n")) {
    return privateKey.replace(/\\n/g, "\n");
  }
  return privateKey;
}

/**
 * FirestoreConfigオブジェクトの秘密鍵をフォーマットする
 * @param config 元のconfigオブジェクト
 * @returns 秘密鍵をフォーマットしたconfigオブジェクト
 */
export function formatConfig(config: FirestoreConfig): FirestoreConfig {
  return {
    ...config,
    privateKey: formatPrivateKey(config.privateKey),
  };
}
