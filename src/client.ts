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
  private configChecked: boolean = false;

  /**
   * コンストラクタ
   * @param config Firestore設定オブジェクト
   */
  constructor(config: FirestoreConfig) {
    this.config = config;
    // ビルド時にはチェックを行わない
    // 実際の操作時に遅延チェックを行う
  }

  /**
   * 設定パラメータをチェック
   * @private
   */
  private checkConfig() {
    if (this.configChecked) {
      return;
    }

    // 必須パラメータのチェック
    const requiredParams: Array<keyof FirestoreConfig> = [
      "projectId",
      "privateKey",
      "clientEmail",
    ];

    const missingParams = requiredParams.filter(param => !this.config[param]);
    if (missingParams.length > 0) {
      throw new Error(
        `Missing required Firestore configuration parameters: ${missingParams.join(
          ", "
        )}`
      );
    }

    this.configChecked = true;
  }

  /**
   * 認証トークンを取得（キャッシュあり）
   */
  private async getToken(): Promise<string> {
    // 操作前に設定をチェック
    this.checkConfig();

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
   * コレクションリファレンスを取得
   * @param path コレクションパス
   * @returns CollectionReferenceインスタンス
   */
  collection(path: string): CollectionReference {
    // 設定チェックは実際の操作時に行われる
    return new CollectionReference(this, path);
  }

  /**
   * ドキュメントリファレンスを取得
   * @param path ドキュメントパス
   * @returns DocumentReferenceインスタンス
   */
  doc(path: string): DocumentReference {
    // 設定チェックは実際の操作時に行われる
    const parts = path.split("/");
    if (parts.length % 2 === 0) {
      throw new Error(
        "Invalid document path. Document path must point to a document, not a collection."
      );
    }

    const collectionPath = parts.slice(0, parts.length - 1).join("/");
    const docId = parts[parts.length - 1];

    return new DocumentReference(this, collectionPath, docId);
  }

  /**
   * Firestoreにドキュメントを作成
   * @param collectionName コレクション名
   * @param data 作成するデータ
   * @returns 作成されたドキュメント
   */
  async create(collectionName: string, data: Record<string, any>) {
    // 操作前に設定をチェック
    this.checkConfig();

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
    // 操作前に設定をチェック
    this.checkConfig();

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
    // 操作前に設定をチェック
    this.checkConfig();

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
    // 操作前に設定をチェック
    this.checkConfig();

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
    // 操作前に設定をチェック
    this.checkConfig();

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
          direction: options.orderDirection || "ASCENDING",
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
 * コレクションリファレンスクラス
 */
export class CollectionReference {
  private client: FirestoreClient;
  private path: string;
  private _queryConstraints: {
    where: Array<{ field: string; op: string; value: any }>;
    orderBy?: string;
    orderDirection?: string;
    limit?: number;
    offset?: number;
  };

  constructor(client: FirestoreClient, path: string) {
    this.client = client;
    this.path = path;
    this._queryConstraints = {
      where: [],
    };
  }

  /**
   * ドキュメントリファレンスを取得
   * @param documentPath ドキュメントID（省略時は自動生成）
   * @returns DocumentReferenceインスタンス
   */
  doc(documentPath?: string): DocumentReference {
    const docId = documentPath || this._generateId();
    return new DocumentReference(this.client, this.path, docId);
  }

  /**
   * ドキュメントを追加（IDは自動生成）
   * @param data ドキュメントデータ
   * @returns 作成されたドキュメントのリファレンス
   */
  async add(data: Record<string, any>): Promise<DocumentReference> {
    const result = await this.client.create(this.path, data);
    const docId = result.id;
    return new DocumentReference(this.client, this.path, docId);
  }

  /**
   * フィルター条件を追加
   * @param fieldPath フィールドパス
   * @param opStr 演算子
   * @param value 値
   * @returns Queryインスタンス
   */
  where(fieldPath: string, opStr: string, value: any): Query {
    const query = new Query(this.client, this.path, {
      ...this._queryConstraints,
    });

    // 演算子の変換
    let firestoreOp: string;
    switch (opStr) {
      case "==":
        firestoreOp = "EQUAL";
        break;
      case "!=":
        firestoreOp = "NOT_EQUAL";
        break;
      case "<":
        firestoreOp = "LESS_THAN";
        break;
      case "<=":
        firestoreOp = "LESS_THAN_OR_EQUAL";
        break;
      case ">":
        firestoreOp = "GREATER_THAN";
        break;
      case ">=":
        firestoreOp = "GREATER_THAN_OR_EQUAL";
        break;
      case "array-contains":
        firestoreOp = "ARRAY_CONTAINS";
        break;
      case "in":
        firestoreOp = "IN";
        break;
      case "array-contains-any":
        firestoreOp = "ARRAY_CONTAINS_ANY";
        break;
      case "not-in":
        firestoreOp = "NOT_IN";
        break;
      default:
        firestoreOp = opStr;
    }

    query._queryConstraints.where.push({
      field: fieldPath,
      op: firestoreOp,
      value,
    });

    return query;
  }

  /**
   * 並べ替え条件を追加
   * @param fieldPath フィールドパス
   * @param directionStr 並べ替え方向（'asc'または'desc'）
   * @returns Queryインスタンス
   */
  orderBy(fieldPath: string, directionStr: "asc" | "desc" = "asc"): Query {
    const query = new Query(this.client, this.path, {
      ...this._queryConstraints,
    });
    query._queryConstraints.orderBy = fieldPath;
    query._queryConstraints.orderDirection =
      directionStr === "asc" ? "ASCENDING" : "DESCENDING";
    return query;
  }

  /**
   * 取得件数の制限を設定
   * @param limit 最大件数
   * @returns Queryインスタンス
   */
  limit(limit: number): Query {
    const query = new Query(this.client, this.path, {
      ...this._queryConstraints,
    });
    query._queryConstraints.limit = limit;
    return query;
  }

  /**
   * スキップ件数を設定
   * @param offset スキップ件数
   * @returns Queryインスタンス
   */
  offset(offset: number): Query {
    const query = new Query(this.client, this.path, {
      ...this._queryConstraints,
    });
    query._queryConstraints.offset = offset;
    return query;
  }

  /**
   * クエリを実行
   * @returns QuerySnapshotインスタンス
   */
  async get(): Promise<QuerySnapshot> {
    const results = await this.client.query(this.path, this._queryConstraints);
    return new QuerySnapshot(results);
  }

  /**
   * ランダムなIDを生成
   * @returns ランダムなID
   */
  private _generateId(): string {
    // 20文字のランダムなIDを生成
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 20; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}

/**
 * ドキュメントリファレンスクラス
 */
export class DocumentReference {
  private client: FirestoreClient;
  private collectionPath: string;
  private docId: string;

  constructor(client: FirestoreClient, collectionPath: string, docId: string) {
    this.client = client;
    this.collectionPath = collectionPath;
    this.docId = docId;
  }

  /**
   * ドキュメントIDを取得
   */
  get id(): string {
    return this.docId;
  }

  /**
   * ドキュメントのパスを取得
   */
  get path(): string {
    return `${this.collectionPath}/${this.docId}`;
  }

  /**
   * サブコレクションを取得
   * @param collectionPath サブコレクション名
   * @returns CollectionReferenceインスタンス
   */
  collection(collectionPath: string): CollectionReference {
    return new CollectionReference(
      this.client,
      `${this.path}/${collectionPath}`
    );
  }

  /**
   * ドキュメントを取得
   * @returns DocumentSnapshotインスタンス
   */
  async get(): Promise<DocumentSnapshot> {
    const data = await this.client.get(this.collectionPath, this.docId);
    return new DocumentSnapshot(this.docId, data);
  }

  /**
   * ドキュメントを作成または上書き
   * @param data ドキュメントデータ
   * @param options オプション（mergeは現在サポートされていません）
   * @returns WriteResultインスタンス
   */
  async set(
    data: Record<string, any>,
    options?: { merge?: boolean }
  ): Promise<WriteResult> {
    // 既存のドキュメントを取得
    const existingDoc = await this.client.get(this.collectionPath, this.docId);

    if (existingDoc) {
      // 既存のドキュメントがある場合は更新
      const mergedData = options?.merge ? { ...existingDoc, ...data } : data;
      await this.client.update(this.collectionPath, this.docId, mergedData);
    } else {
      // 新規作成
      const newData = { ...data, id: this.docId };
      await this.client.create(this.collectionPath, newData);
    }

    return new WriteResult();
  }

  /**
   * ドキュメントを更新
   * @param data 更新データ
   * @returns WriteResultインスタンス
   */
  async update(data: Record<string, any>): Promise<WriteResult> {
    await this.client.update(this.collectionPath, this.docId, data);
    return new WriteResult();
  }

  /**
   * ドキュメントを削除
   * @returns WriteResultインスタンス
   */
  async delete(): Promise<WriteResult> {
    await this.client.delete(this.collectionPath, this.docId);
    return new WriteResult();
  }
}

/**
 * クエリクラス
 */
export class Query {
  private client: FirestoreClient;
  private collectionPath: string;
  _queryConstraints: {
    where: Array<{ field: string; op: string; value: any }>;
    orderBy?: string;
    orderDirection?: string;
    limit?: number;
    offset?: number;
  };

  constructor(
    client: FirestoreClient,
    collectionPath: string,
    constraints: {
      where: Array<{ field: string; op: string; value: any }>;
      orderBy?: string;
      orderDirection?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    this.client = client;
    this.collectionPath = collectionPath;
    this._queryConstraints = constraints;
  }

  /**
   * フィルター条件を追加
   * @param fieldPath フィールドパス
   * @param opStr 演算子
   * @param value 値
   * @returns Queryインスタンス
   */
  where(fieldPath: string, opStr: string, value: any): Query {
    const query = new Query(this.client, this.collectionPath, {
      ...this._queryConstraints,
    });

    // 演算子の変換
    let firestoreOp: string;
    switch (opStr) {
      case "==":
        firestoreOp = "EQUAL";
        break;
      case "!=":
        firestoreOp = "NOT_EQUAL";
        break;
      case "<":
        firestoreOp = "LESS_THAN";
        break;
      case "<=":
        firestoreOp = "LESS_THAN_OR_EQUAL";
        break;
      case ">":
        firestoreOp = "GREATER_THAN";
        break;
      case ">=":
        firestoreOp = "GREATER_THAN_OR_EQUAL";
        break;
      case "array-contains":
        firestoreOp = "ARRAY_CONTAINS";
        break;
      case "in":
        firestoreOp = "IN";
        break;
      case "array-contains-any":
        firestoreOp = "ARRAY_CONTAINS_ANY";
        break;
      case "not-in":
        firestoreOp = "NOT_IN";
        break;
      default:
        firestoreOp = opStr;
    }

    query._queryConstraints.where.push({
      field: fieldPath,
      op: firestoreOp,
      value,
    });

    return query;
  }

  /**
   * 並べ替え条件を追加
   * @param fieldPath フィールドパス
   * @param directionStr 並べ替え方向（'asc'または'desc'）
   * @returns Queryインスタンス
   */
  orderBy(fieldPath: string, directionStr: "asc" | "desc" = "asc"): Query {
    const query = new Query(this.client, this.collectionPath, {
      ...this._queryConstraints,
    });
    query._queryConstraints.orderBy = fieldPath;
    query._queryConstraints.orderDirection =
      directionStr === "asc" ? "ASCENDING" : "DESCENDING";
    return query;
  }

  /**
   * 取得件数の制限を設定
   * @param limit 最大件数
   * @returns Queryインスタンス
   */
  limit(limit: number): Query {
    const query = new Query(this.client, this.collectionPath, {
      ...this._queryConstraints,
    });
    query._queryConstraints.limit = limit;
    return query;
  }

  /**
   * スキップ件数を設定
   * @param offset スキップ件数
   * @returns Queryインスタンス
   */
  offset(offset: number): Query {
    const query = new Query(this.client, this.collectionPath, {
      ...this._queryConstraints,
    });
    query._queryConstraints.offset = offset;
    return query;
  }

  /**
   * クエリを実行
   * @returns QuerySnapshotインスタンス
   */
  async get(): Promise<QuerySnapshot> {
    const results = await this.client.query(
      this.collectionPath,
      this._queryConstraints
    );
    return new QuerySnapshot(results);
  }
}

/**
 * クエリ結果クラス
 */
export class QuerySnapshot {
  private _docs: DocumentSnapshot[];

  constructor(results: Array<Record<string, any>>) {
    this._docs = results.map(doc => {
      const { id, ...data } = doc;
      return new DocumentSnapshot(id, data);
    });
  }

  /**
   * 結果のドキュメント配列
   */
  get docs(): DocumentSnapshot[] {
    return this._docs;
  }

  /**
   * 結果が空かどうか
   */
  get empty(): boolean {
    return this._docs.length === 0;
  }

  /**
   * 結果の件数
   */
  get size(): number {
    return this._docs.length;
  }

  /**
   * 各ドキュメントに対してコールバックを実行
   * @param callback 各ドキュメントに対して実行するコールバック関数
   */
  forEach(callback: (result: DocumentSnapshot) => void): void {
    this._docs.forEach(callback);
  }
}

/**
 * ドキュメントスナップショットクラス
 */
export class DocumentSnapshot {
  private _id: string;
  private _data: Record<string, any> | null;

  constructor(id: string, data: Record<string, any> | null) {
    this._id = id;
    this._data = data;
  }

  /**
   * ドキュメントID
   */
  get id(): string {
    return this._id;
  }

  /**
   * ドキュメントが存在するかどうか
   */
  get exists(): boolean {
    return this._data !== null;
  }

  /**
   * ドキュメントデータを取得
   * @returns ドキュメントデータ（存在しない場合はundefined）
   */
  data(): Record<string, any> | undefined {
    return this._data || undefined;
  }
}

/**
 * 書き込み結果クラス
 */
export class WriteResult {
  /**
   * 書き込み時刻
   */
  readonly writeTime: Date;

  constructor() {
    this.writeTime = new Date();
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
