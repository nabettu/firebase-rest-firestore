import { FirestoreConfig, FirestoreResponse, QueryOptions } from "./types";
import { getFirestoreToken } from "./utils/auth";
import {
  convertFromFirestoreDocument,
  convertToFirestoreDocument,
  convertToFirestoreValue,
} from "./utils/converter";
import { getFirestoreBasePath } from "./utils/path";

/**
 * Firestoreクライアントクラス
 */
export class FirestoreClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private config: FirestoreConfig;

  /**
   * コンストラクタ
   * @param config Firestore設定オブジェクト
   */
  constructor(config: FirestoreConfig) {
    this.config = config;

    // 必須パラメータのチェック
    const requiredParams: Array<keyof FirestoreConfig> = [
      "projectId",
      "privateKey",
      "clientEmail",
    ];

    const missingParams = requiredParams.filter(param => !this.config[param]);
    if (missingParams.length > 0) {
      throw new Error(
        `必須のFirestore設定パラメータが不足しています: ${missingParams.join(
          ", "
        )}`
      );
    }
  }

  /**
   * 認証トークンを取得（キャッシュあり）
   */
  private async getToken(): Promise<string> {
    const now = Date.now();
    // トークンが期限切れか未取得の場合は新しく取得
    if (!this.token || now >= this.tokenExpiry) {
      this.token = await getFirestoreToken(this.config);
      // 50分後に期限切れとする（実際は1時間）
      this.tokenExpiry = now + 50 * 60 * 1000;
    }
    return this.token;
  }

  /**
   * Firestoreにドキュメントを作成
   * @param collectionName コレクション名
   * @param data 作成するデータ
   * @returns 作成されたドキュメント
   */
  async create(collectionName: string, data: Record<string, any>) {
    const url = getFirestoreBasePath(this.config.projectId, collectionName);
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
   * @param collectionName コレクション名
   * @param documentId ドキュメントID
   * @returns 取得したドキュメント（存在しない場合はnull）
   */
  async get(collectionName: string, documentId: string) {
    const url = `${getFirestoreBasePath(
      this.config.projectId,
      collectionName
    )}/${documentId}`;

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
   * @param collectionName コレクション名
   * @param documentId ドキュメントID
   * @param data 更新するデータ
   * @returns 更新されたドキュメント
   */
  async update(
    collectionName: string,
    documentId: string,
    data: Record<string, any>
  ) {
    const url = `${getFirestoreBasePath(
      this.config.projectId,
      collectionName
    )}/${documentId}`;
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
   * @param collectionName コレクション名
   * @param documentId ドキュメントID
   * @returns 削除成功時はtrue
   */
  async delete(collectionName: string, documentId: string) {
    const url = `${getFirestoreBasePath(
      this.config.projectId,
      collectionName
    )}/${documentId}`;

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
   * @param collectionName コレクション名
   * @param options クエリオプション
   * @returns 検索結果のドキュメント配列
   */
  async query(collectionName: string, options: QueryOptions = {}) {
    const url = `${getFirestoreBasePath(
      this.config.projectId,
      collectionName
    )}:runQuery`;

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

/**
 * 新しいFirestoreクライアントインスタンスを作成
 * @param config Firestore設定オブジェクト
 * @returns FirestoreClientインスタンス
 */
export function createFirestoreClient(config: FirestoreConfig) {
  return new FirestoreClient(config);
}
