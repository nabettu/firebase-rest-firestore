import * as jose from "jose";

// Firestore関連の定数
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_PRIVATE_KEY_ID = process.env.FIREBASE_PRIVATE_KEY_ID;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(
  /\\n/g,
  "\n"
);
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_CLIENT_ID = process.env.FIREBASE_CLIENT_ID;
const FIREBASE_CLIENT_CERT_URL = process.env.FIREBASE_CLIENT_CERT_URL;

// サービスアカウント情報
const serviceAccount = {
  type: "service_account",
  project_id: FIREBASE_PROJECT_ID,
  private_key_id: FIREBASE_PRIVATE_KEY_ID,
  private_key: FIREBASE_PRIVATE_KEY,
  client_email: FIREBASE_CLIENT_EMAIL,
  client_id: FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: FIREBASE_CLIENT_CERT_URL,
};

// Firestoreのベースパス
const getFirestoreBasePath = (collectionName?: string) => {
  const basePath = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  return collectionName ? `${basePath}/${collectionName}` : basePath;
};

// Firestoreの値型定義
type FirestoreFieldValue =
  | { stringValue: string }
  | { integerValue: number }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields: Record<string, FirestoreFieldValue> } }
  | { arrayValue: { values: FirestoreFieldValue[] } };

// Firestoreドキュメント型
interface FirestoreDocument {
  name?: string;
  fields: Record<string, FirestoreFieldValue>;
  createTime?: string;
  updateTime?: string;
}

// Firestoreレスポンス型
interface FirestoreResponse {
  name: string;
  fields?: Record<string, FirestoreFieldValue>;
  createTime?: string;
  updateTime?: string;
}

/**
 * JSの値をFirestore形式に変換する
 */
function convertToFirestoreValue(value: any): FirestoreFieldValue {
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  } else if (typeof value === "string") {
    return { stringValue: value };
  } else if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: value }
      : { doubleValue: value };
  } else if (typeof value === "boolean") {
    return { booleanValue: value };
  } else if (value === null || value === undefined) {
    return { nullValue: null };
  } else if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(item => convertToFirestoreValue(item)),
      },
    };
  } else if (typeof value === "object") {
    const fields = Object.entries(value).reduce(
      (acc, [key, val]) => ({
        ...acc,
        [key]: convertToFirestoreValue(val),
      }),
      {}
    );
    return { mapValue: { fields } };
  }

  // デフォルトは文字列化
  return { stringValue: String(value) };
}

/**
 * Firestore形式からJSの値に変換する
 */
function convertFromFirestoreValue(firestoreValue: FirestoreFieldValue): any {
  if ("stringValue" in firestoreValue) {
    return firestoreValue.stringValue;
  } else if ("integerValue" in firestoreValue) {
    return Number(firestoreValue.integerValue);
  } else if ("doubleValue" in firestoreValue) {
    return firestoreValue.doubleValue;
  } else if ("booleanValue" in firestoreValue) {
    return firestoreValue.booleanValue;
  } else if ("nullValue" in firestoreValue) {
    return null;
  } else if ("timestampValue" in firestoreValue) {
    return new Date(firestoreValue.timestampValue);
  } else if ("mapValue" in firestoreValue && firestoreValue.mapValue.fields) {
    return Object.entries(firestoreValue.mapValue.fields).reduce(
      (acc, [key, val]) => ({
        ...acc,
        [key]: convertFromFirestoreValue(val),
      }),
      {}
    );
  } else if (
    "arrayValue" in firestoreValue &&
    firestoreValue.arrayValue.values
  ) {
    return firestoreValue.arrayValue.values.map(convertFromFirestoreValue);
  }

  return null;
}

/**
 * オブジェクトをFirestoreドキュメント形式に変換
 */
function convertToFirestoreDocument(
  data: Record<string, any>
): FirestoreDocument {
  return {
    fields: Object.entries(data).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: convertToFirestoreValue(value),
      }),
      {}
    ),
  };
}

/**
 * Firestoreドキュメントをオブジェクトに変換
 */
function convertFromFirestoreDocument(
  doc: FirestoreResponse
): Record<string, any> & { id: string } {
  if (!doc.fields) return { id: getDocumentId(doc.name) };

  const result = Object.entries(doc.fields).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: convertFromFirestoreValue(value),
    }),
    {}
  );

  return {
    ...result,
    id: getDocumentId(doc.name),
  };
}

/**
 * ドキュメントパスからIDを抽出
 */
function getDocumentId(path?: string): string {
  if (!path) return "";
  const pathParts = path.split("/");
  return pathParts[pathParts.length - 1];
}

// JWT（JSON Web Token）を作成する関数
async function createJWT(serviceAccount: any) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1時間後に期限切れ
    scope: "https://www.googleapis.com/auth/datastore",
  };

  try {
    // 秘密鍵をインポート
    const privateKey = await jose.importPKCS8(
      serviceAccount.private_key,
      "RS256"
    );

    // JWTを作成
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({
        alg: "RS256",
        kid: serviceAccount.private_key_id,
        typ: "JWT",
      })
      .sign(privateKey);

    return token;
  } catch (error) {
    console.error("JWT作成エラー:", error);
    throw error;
  }
}

/**
 * Firestoreの認証トークンを取得する関数
 */
export async function getFirestoreToken() {
  // トークンを取得するためのリクエスト
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await createJWT(serviceAccount),
    }),
  });

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Firestoreクライアントクラス
 */
export class FirestoreClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * 認証トークンを取得（キャッシュあり）
   */
  private async getToken(): Promise<string> {
    const now = Date.now();
    // トークンが期限切れか未取得の場合は新しく取得
    if (!this.token || now >= this.tokenExpiry) {
      this.token = await getFirestoreToken();
      // 50分後に期限切れとする（実際は1時間）
      this.tokenExpiry = now + 50 * 60 * 1000;
    }
    return this.token;
  }

  /**
   * Firestoreにドキュメントを作成
   */
  async create(collectionName: string, data: Record<string, any>) {
    const url = getFirestoreBasePath(collectionName);
    const firestoreData = convertToFirestoreDocument(data);

    const token = await this.getToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(firestoreData),
    });

    if (!response.ok) {
      throw new Error(`Firestore API error: ${response.statusText}`);
    }

    const result = (await response.json()) as FirestoreResponse;
    return convertFromFirestoreDocument(result);
  }

  /**
   * ドキュメントを取得
   */
  async get(collectionName: string, documentId: string) {
    const url = `${getFirestoreBasePath(collectionName)}/${documentId}`;

    const token = await this.getToken();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Firestore API error: ${response.statusText}`);
    }

    const result = (await response.json()) as FirestoreResponse;
    return convertFromFirestoreDocument(result);
  }

  /**
   * ドキュメントを更新
   */
  async update(
    collectionName: string,
    documentId: string,
    data: Record<string, any>
  ) {
    const url = `${getFirestoreBasePath(collectionName)}/${documentId}`;
    const firestoreData = convertToFirestoreDocument(data);

    const token = await this.getToken();
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(firestoreData),
    });

    if (!response.ok) {
      throw new Error(`Firestore API error: ${response.statusText}`);
    }

    const result = (await response.json()) as FirestoreResponse;
    return convertFromFirestoreDocument(result);
  }

  /**
   * ドキュメントを削除
   */
  async delete(collectionName: string, documentId: string) {
    const url = `${getFirestoreBasePath(collectionName)}/${documentId}`;

    const token = await this.getToken();
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Firestore API error: ${response.statusText}`);
    }

    return true;
  }

  /**
   * コレクションのドキュメントを検索
   */
  async query(
    collectionName: string,
    options: {
      where?: Array<{ field: string; op: string; value: any }>;
      orderBy?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const url = `${getFirestoreBasePath(collectionName)}:runQuery`;

    // クエリ構築
    const structuredQuery: any = {
      from: [{ collectionId: collectionName }],
    };

    // フィルター条件
    if (options.where && options.where.length > 0) {
      structuredQuery.where = {
        compositeFilter: {
          op: "AND",
          filters: options.where.map(condition => ({
            fieldFilter: {
              field: { fieldPath: condition.field },
              op: condition.op,
              value: convertToFirestoreValue(condition.value),
            },
          })),
        },
      };
    }

    // 並べ替え
    if (options.orderBy) {
      structuredQuery.orderBy = [
        {
          field: { fieldPath: options.orderBy },
          direction: "ASCENDING",
        },
      ];
    }

    // 制限
    if (options.limit) {
      structuredQuery.limit = options.limit;
    }

    // オフセット
    if (options.offset) {
      structuredQuery.offset = options.offset;
    }

    const token = await this.getToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        structuredQuery,
      }),
    });

    if (!response.ok) {
      throw new Error(`Firestore API error: ${response.statusText}`);
    }

    const results = (await response.json()) as Array<{
      document?: FirestoreResponse;
    }>;
    return results
      .filter(item => item.document)
      .map(item => convertFromFirestoreDocument(item.document!));
  }
}

// デフォルトのFirestoreクライアントインスタンス
export const firestore = new FirestoreClient();

// 後方互換性のための関数
export async function saveToFirestore(
  collectionName: string,
  data: Record<string, any>
) {
  const result = await firestore.create(collectionName, data);
  return { documentId: result.id, result };
}
