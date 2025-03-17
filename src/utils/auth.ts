import * as jose from "jose";
import { FirestoreConfig } from "../types";

/**
 * JWT（JSON Web Token）を作成する関数
 * @param config Firestore設定
 * @returns JWT文字列
 */
export async function createJWT(config: FirestoreConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.clientEmail,
    sub: config.clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1時間後に期限切れ
    scope: "https://www.googleapis.com/auth/datastore",
  };

  try {
    // 秘密鍵をインポート
    const privateKey = await jose.importPKCS8(config.privateKey, "RS256");

    // JWTを作成
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({
        alg: "RS256",
        typ: "JWT",
      })
      .sign(privateKey);

    return token;
  } catch (error) {
    console.error("Error creating JWT:", error);
    throw error;
  }
}

/**
 * Firestoreの認証トークンを取得する関数
 * @param config Firestore設定
 * @returns アクセストークン
 */
export async function getFirestoreToken(
  config: FirestoreConfig
): Promise<string> {
  // トークンを取得するためのリクエスト
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await createJWT(config),
    }),
  });

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
