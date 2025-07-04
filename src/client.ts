import { FirestoreConfig, FirestoreResponse, QueryOptions } from "./types";
import { getFirestoreToken } from "./utils/auth";
import {
  convertFromFirestoreDocument,
  convertToFirestoreDocument,
  convertToFirestoreValue,
} from "./utils/converter";
import { getFirestoreBasePath } from "./utils/path";
import { formatPrivateKey } from "./utils/config";
import { FirestorePath, createFirestorePath } from "./utils/path";

/**
 * Firestore client class
 */
export class FirestoreClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private config: FirestoreConfig;
  private configChecked: boolean = false;
  private debug: boolean = false;
  private pathUtil: FirestorePath;

  /**
   * Constructor
   * @param config Firestore configuration object
   */
  constructor(config: FirestoreConfig) {
    this.config = config;
    this.pathUtil = createFirestorePath(config, config.debug || false);
    this.debug = !!config.debug;

    // Log configuration if debug is enabled
    if (this.debug) {
      console.log(
        "Firestore client initialized with config:",
        JSON.stringify(this.config, null, 2)
      );
    }
  }

  /**
   * Check configuration parameters
   * @private
   */
  private checkConfig() {
    if (this.configChecked) {
      return;
    }

    // 必須パラメータのチェック
    const requiredParams: Array<keyof FirestoreConfig> = ["projectId"];

    // Only require auth parameters when not using emulator
    if (!this.config.useEmulator) {
      requiredParams.push("privateKey", "clientEmail");
    }

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
   * Get authentication token (with caching)
   */
  private async getToken(): Promise<string> {
    // Check settings before operation
    this.checkConfig();

    // In emulator mode, we don't need a token
    if (this.config.useEmulator) {
      if (this.debug) {
        console.log("Emulator mode: skipping token generation");
      }
      return "emulator-fake-token";
    }

    const now = Date.now();
    // トークンが期限切れか未取得の場合は新しく取得
    if (!this.token || now >= this.tokenExpiry) {
      if (this.debug) {
        console.log("Generating new auth token");
      }
      this.token = await getFirestoreToken(this.config);
      // 50分後に期限切れとする（実際は1時間）
      this.tokenExpiry = now + 50 * 60 * 1000;
    }
    return this.token;
  }

  /**
   * Prepare request headers
   * @param additionalHeaders Additional headers
   * @returns Prepared headers object
   * @private
   */
  private async prepareHeaders(
    additionalHeaders: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...additionalHeaders,
    };

    // Only add auth token for production environment
    if (!this.config.useEmulator) {
      const token = await this.getToken();
      headers["Authorization"] = `Bearer ${token}`;
    } else if (this.debug) {
      console.log("Using emulator mode, skipping authorization header");
    }

    return headers;
  }

  /**
   * Get collection reference
   * @param path Collection path
   * @returns CollectionReference instance
   */
  collection(path: string): CollectionReference {
    // Configuration check is performed at the time of actual operation
    return new CollectionReference(this, path);
  }

  /**
   * Get document reference
   * @param path Document path
   * @returns DocumentReference instance
   */
  doc(path: string): DocumentReference {
    // Configuration check is performed at the time of actual operation
    const parts = path.split("/");
    if (parts.length % 2 !== 0) {
      throw new Error(
        "Invalid document path. Document path must point to a document, not a collection."
      );
    }

    const collectionPath = parts.slice(0, parts.length - 1).join("/");
    const docId = parts[parts.length - 1];

    return new DocumentReference(this, collectionPath, docId);
  }

  /**
   * Get collection group reference
   * @param path Collection group ID
   * @returns CollectionGroup instance
   */
  collectionGroup(path: string): CollectionGroup {
    return new CollectionGroup(this, path);
  }

  /**
   * Add document to Firestore
   * @param collectionName Collection name
   * @param data Data to add
   * @returns Added document
   */
  async add(collectionName: string, data: Record<string, any>) {
    // Check settings before operation
    this.checkConfig();

    if (this.debug) {
      console.log(`Adding document to collection: ${collectionName}`, data);
    }

    const url = this.pathUtil.getCollectionPath(collectionName);
    const firestoreData = convertToFirestoreDocument(data);

    if (this.debug) {
      console.log(`Making request to: ${url}`, firestoreData);
    }

    const headers = await this.prepareHeaders();

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(firestoreData),
    });

    if (this.debug) {
      console.log(`Response status: ${response.status}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (this.debug) {
        console.error(`Error response: ${errorText}`);
      }
      throw new Error(
        `Firestore API error: ${
          response.statusText || response.status
        } - ${errorText}`
      );
    }

    const result = (await response.json()) as FirestoreResponse;
    return convertFromFirestoreDocument(result);
  }

  /**
   * Get document
   * @param collectionName Collection name
   * @param documentId Document ID
   * @returns Retrieved document (null if it doesn't exist)
   */
  async get(collectionName: string, documentId: string) {
    // Check settings before operation
    this.checkConfig();

    if (this.debug) {
      console.log(
        `Getting document from collection: ${collectionName}, documentId: ${documentId}`
      );
    }

    const url = this.pathUtil.getDocumentPath(collectionName, documentId);

    if (this.debug) {
      console.log(`Making request to: ${url}`);
    }

    const headers = await this.prepareHeaders();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (this.debug) {
        console.log(`Response status: ${response.status}`);
      }

      // Capture response text for debugging
      const responseText = await response.text();
      if (this.debug) {
        console.log(
          `Response text: ${responseText.substring(0, 200)}${
            responseText.length > 200 ? "..." : ""
          }`
        );
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(
          `Firestore API error: ${
            response.statusText || response.status
          } - ${responseText}`
        );
      }

      // Parse the response text
      const result = JSON.parse(responseText) as FirestoreResponse;
      return convertFromFirestoreDocument(result);
    } catch (error) {
      console.error("Error in get method:", error);
      throw error;
    }
  }

  /**
   * Update document
   * @param collectionName Collection name
   * @param documentId Document ID
   * @param data Data to update
   * @returns Updated document
   */
  async update(
    collectionName: string,
    documentId: string,
    data: Record<string, any>
  ) {
    // Check settings before operation
    this.checkConfig();

    if (this.debug) {
      console.log(
        `Updating document in collection: ${collectionName}, documentId: ${documentId}`,
        data
      );
    }

    const url = this.pathUtil.getDocumentPath(collectionName, documentId);

    if (this.debug) {
      console.log(`Making request to: ${url}`);
    }

    // Get existing document and merge
    const existingDoc = await this.get(collectionName, documentId);
    if (existingDoc) {
      // Check for nested fields
      // Check if data contains dot notation keys (e.g., "favorites.color")
      const updateData = { ...data };
      const dotNotationKeys = Object.keys(data).filter(key =>
        key.includes(".")
      );

      if (dotNotationKeys.length > 0) {
        // スプレッド演算子でコピーして元のオブジェクトを変更しないようにする
        const result = { ...existingDoc };

        // 通常のキーを先に適用
        Object.keys(data)
          .filter(key => !key.includes("."))
          .forEach(key => {
            result[key] = data[key];
          });

        // ドット記法のキーを処理
        dotNotationKeys.forEach(path => {
          const parts = path.split(".");
          let current = result;

          // 最後のパーツ以外をたどってネストしたオブジェクトに到達
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            // パスが存在しない場合は新しいオブジェクトを作成
            if (!current[part] || typeof current[part] !== "object") {
              current[part] = {};
            }
            current = current[part];
          }

          // 最後のパーツに値を設定
          const lastPart = parts[parts.length - 1];
          current[lastPart] = data[path];

          // 元のデータからドット記法のキーを削除
          delete updateData[path];
        });

        data = result;
      } else {
        // 通常のマージ
        data = { ...existingDoc, ...data };
      }
    }

    const firestoreData = convertToFirestoreDocument(data);

    const headers = await this.prepareHeaders();
    const response = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(firestoreData),
    });

    if (this.debug) {
      console.log(`Response status: ${response.status}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (this.debug) {
        console.error(`Error response: ${errorText}`);
      }
      throw new Error(
        `Firestore API error: ${
          response.statusText || response.status
        } - ${errorText}`
      );
    }

    const result = (await response.json()) as FirestoreResponse;
    return convertFromFirestoreDocument(result);
  }

  /**
   * Delete document
   * @param collectionName Collection name
   * @param documentId Document ID
   * @returns true if deletion successful
   */
  async delete(collectionName: string, documentId: string) {
    // Check settings before operation
    this.checkConfig();

    if (this.debug) {
      console.log(
        `Deleting document from collection: ${collectionName}, documentId: ${documentId}`
      );
    }

    const url = this.pathUtil.getDocumentPath(collectionName, documentId);

    if (this.debug) {
      console.log(`Making request to: ${url}`);
    }

    // Different header handling for emulator
    const headers: Record<string, string> = {};

    // Only add auth token for production environment
    if (!this.config.useEmulator) {
      const token = await this.getToken();
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    if (this.debug) {
      console.log(`Response status: ${response.status}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (this.debug) {
        console.error(`Error response: ${errorText}`);
      }
      throw new Error(
        `Firestore API error: ${
          response.statusText || response.status
        } - ${errorText}`
      );
    }

    return true;
  }

  /**
   * Query documents in a collection
   * @param collectionPath Collection path
   * @param options Query options
   * @param allDescendants Whether to include descendant collections
   * @returns Array of documents matching the query
   */
  async query(
    collectionPath: string,
    options: QueryOptions = {},
    allDescendants: boolean = false
  ) {
    // Check settings before operation
    this.checkConfig();

    try {
      // Parse the collection path
      const segments = collectionPath.split("/");
      const collectionId = segments[segments.length - 1];

      // Get the proper runQuery URL from our path helper
      const queryUrl = this.pathUtil.getRunQueryPath(collectionPath);

      if (this.debug) {
        console.log(`Executing query on collection: ${collectionPath}`);
        console.log(`Using runQuery URL: ${queryUrl}`);
      }

      // Create the structured query
      const requestBody: any = {
        structuredQuery: {
          from: [
            {
              collectionId,
              allDescendants,
            },
          ],
        },
      };

      // Add where filters if present
      if (options.where && options.where.length > 0) {
        // Map our operators to Firestore REST API operators
        const opMap: Record<string, string> = {
          "==": "EQUAL",
          "!=": "NOT_EQUAL",
          "<": "LESS_THAN",
          "<=": "LESS_THAN_OR_EQUAL",
          ">": "GREATER_THAN",
          ">=": "GREATER_THAN_OR_EQUAL",
          "array-contains": "ARRAY_CONTAINS",
          in: "IN",
          "array-contains-any": "ARRAY_CONTAINS_ANY",
          "not-in": "NOT_IN",
        };

        // Single where clause
        if (options.where.length === 1) {
          const filter = options.where[0];
          const firestoreOp = opMap[filter.op] || filter.op;

          requestBody.structuredQuery.where = {
            fieldFilter: {
              field: { fieldPath: filter.field },
              op: firestoreOp,
              value: convertToFirestoreValue(filter.value),
            },
          };
        }
        // Multiple where clauses (AND)
        else {
          requestBody.structuredQuery.where = {
            compositeFilter: {
              op: "AND",
              filters: options.where.map(filter => {
                const firestoreOp = opMap[filter.op] || filter.op;
                return {
                  fieldFilter: {
                    field: { fieldPath: filter.field },
                    op: firestoreOp,
                    value: convertToFirestoreValue(filter.value),
                  },
                };
              }),
            },
          };
        }
      }

      // Add order by if present
      if (options.orderBy) {
        requestBody.structuredQuery.orderBy = [
          {
            field: { fieldPath: options.orderBy },
            direction: options.orderDirection || "ASCENDING",
          },
        ];
      }

      // Add limit if present
      if (options.limit) {
        requestBody.structuredQuery.limit = options.limit;
      }

      // Add offset if present
      if (options.offset) {
        requestBody.structuredQuery.offset = options.offset;
      }

      if (this.debug) {
        console.log(`Request payload:`, JSON.stringify(requestBody, null, 2));
      }

      // Use the existing prepareHeaders method for authentication consistency
      const headers = await this.prepareHeaders();

      const response = await fetch(queryUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      // Collect response for debugging
      const responseText = await response.text();

      if (this.debug) {
        console.log(`API Response:`, responseText);
      }

      if (!response.ok) {
        throw new Error(
          `Firestore API error: ${response.status} - ${responseText}`
        );
      }

      // Parse the response
      const results = JSON.parse(responseText);

      if (this.debug) {
        console.log(`Results count: ${results?.length || 0}`);
      }

      // Process the results
      if (!Array.isArray(results)) {
        return [];
      }

      const convertedResults = results
        .filter(item => item.document)
        .map(item => convertFromFirestoreDocument(item.document));

      if (this.debug) {
        console.log(`Converted results:`, convertedResults);
      }

      return convertedResults;
    } catch (error) {
      console.error("Query execution error:", error);
      throw error;
    }
  }

  /**
   * ドキュメントを作成または上書き
   * @param collectionName コレクション名
   * @param documentId ドキュメントID
   * @param data ドキュメントデータ
   * @returns 作成されたドキュメントのリファレンス
   */
  async createWithId(
    collectionName: string,
    documentId: string,
    data: Record<string, any>
  ) {
    // 操作前に設定をチェック
    this.checkConfig();

    const url = `${getFirestoreBasePath(
      this.config.projectId,
      this.config.databaseId,
      this.config
    )}/${collectionName}/${documentId}`;

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
}

/**
 * Collection reference class
 */
export class CollectionReference {
  private client: FirestoreClient;
  private _path: string;
  private _queryConstraints: {
    where: Array<{ field: string; op: string; value: any }>;
    orderBy?: string;
    orderDirection?: string;
    limit?: number;
    offset?: number;
  };

  constructor(client: FirestoreClient, path: string) {
    this.client = client;
    this._path = path;
    this._queryConstraints = {
      where: [],
    };
  }

  /**
   * Get collection path
   */
  get path(): string {
    return this._path;
  }

  /**
   * Whether to include all descendant collections
   */
  get allDescendants(): boolean {
    return false;
  }

  /**
   * Get document reference
   * @param documentPath Document ID (auto-generated if omitted)
   * @returns DocumentReference instance
   */
  doc(documentPath?: string): DocumentReference {
    const docId = documentPath || this._generateId();
    return new DocumentReference(this.client, this.path, docId);
  }

  /**
   * Add document (ID is auto-generated)
   * @param data Document data
   * @returns Reference to the created document
   */
  async add(data: Record<string, any>): Promise<DocumentReference> {
    const result = await this.client.add(this.path, data);
    const docId = result.id;
    return new DocumentReference(this.client, this.path, docId);
  }

  /**
   * Add filter condition
   * @param fieldPath Field path
   * @param opStr Operator
   * @param value Value
   * @returns Query instance
   */
  where(fieldPath: string, opStr: string, value: any): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );

    // Operator conversion
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
   * Add sorting condition
   * @param fieldPath Field path
   * @param directionStr Sort direction ('asc' or 'desc')
   * @returns Query instance
   */
  orderBy(fieldPath: string, directionStr: "asc" | "desc" = "asc"): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.orderBy = fieldPath;
    query._queryConstraints.orderDirection =
      directionStr === "asc" ? "ASCENDING" : "DESCENDING";
    return query;
  }

  /**
   * Set limit on number of results
   * @param limit Maximum number
   * @returns Query instance
   */
  limit(limit: number): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.limit = limit;
    return query;
  }

  /**
   * Set number of documents to skip
   * @param offset Number to skip
   * @returns Query instance
   */
  offset(offset: number): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.offset = offset;
    return query;
  }

  /**
   * Execute query
   * @returns QuerySnapshot instance
   */
  async get(): Promise<QuerySnapshot> {
    const results = await this.client.query(
      this.path,
      this._queryConstraints,
      this.allDescendants
    );
    return new QuerySnapshot(results);
  }

  /**
   * Generate random ID
   * @returns Random ID
   */
  private _generateId(): string {
    // Generate 20-character random ID
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
 * Document reference class
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
   * Get document ID
   */
  get id(): string {
    return this.docId;
  }

  /**
   * Get document path
   */
  get path(): string {
    return `${this.collectionPath}/${this.docId}`;
  }

  /**
   * Get parent collection reference
   */
  get parent(): CollectionReference {
    return new CollectionReference(this.client, this.collectionPath);
  }

  /**
   * Get subcollection
   * @param collectionPath Subcollection name
   * @returns CollectionReference instance
   */
  collection(collectionPath: string): CollectionReference {
    return new CollectionReference(
      this.client,
      `${this.path}/${collectionPath}`
    );
  }

  /**
   * Get document
   * @returns DocumentSnapshot instance
   */
  async get(): Promise<DocumentSnapshot> {
    const data = await this.client.get(this.collectionPath, this.docId);
    return new DocumentSnapshot(this.docId, data);
  }

  /**
   * Create or overwrite document
   * @param data Document data
   * @param options Options (merge is not currently supported)
   * @returns WriteResult instance
   */
  async set(
    data: Record<string, any>,
    options?: { merge?: boolean }
  ): Promise<WriteResult> {
    // Get existing document
    const existingDoc = await this.client.get(this.collectionPath, this.docId);

    if (existingDoc) {
      // If existing document exists, update
      const mergedData = options?.merge ? { ...existingDoc, ...data } : data;
      await this.client.update(this.collectionPath, this.docId, mergedData);
    } else {
      // New creation
      await this.client.createWithId(this.collectionPath, this.docId, data);
    }

    return new WriteResult();
  }

  /**
   * Update document
   * @param data Update data
   * @returns WriteResult instance
   */
  async update(data: Record<string, any>): Promise<WriteResult> {
    await this.client.update(this.collectionPath, this.docId, data);
    return new WriteResult();
  }

  /**
   * Delete document
   * @returns WriteResult instance
   */
  async delete(): Promise<WriteResult> {
    await this.client.delete(this.collectionPath, this.docId);
    return new WriteResult();
  }
}

/**
 * Collection group
 */
export class CollectionGroup {
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
   * Whether to include all descendant collections
   */
  get allDescendants(): boolean {
    return true;
  }

  /**
   * Add filter condition
   * @param fieldPath Field path
   * @param opStr Operator
   * @param value Value
   * @returns Query instance
   */
  where(fieldPath: string, opStr: string, value: any): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );

    // Operator conversion
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
   * Add sorting condition
   * @param fieldPath Field path
   * @param directionStr Sort direction ('asc' or 'desc')
   * @returns Query instance
   */
  orderBy(fieldPath: string, directionStr: "asc" | "desc" = "asc"): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.orderBy = fieldPath;
    query._queryConstraints.orderDirection =
      directionStr === "asc" ? "ASCENDING" : "DESCENDING";
    return query;
  }

  /**
   * Set limit on number of results
   * @param limit Maximum number
   * @returns Query instance
   */
  limit(limit: number): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.limit = limit;
    return query;
  }

  /**
   * Set number of documents to skip
   * @param offset Number to skip
   * @returns Query instance
   */
  offset(offset: number): Query {
    const query = new Query(
      this.client,
      this.path,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.offset = offset;
    return query;
  }

  /**
   * Execute query
   * @returns QuerySnapshot instance
   */
  async get(): Promise<QuerySnapshot> {
    const results = await this.client.query(
      this.path,
      this._queryConstraints,
      this.allDescendants
    );
    return new QuerySnapshot(results);
  }
}

/**
 * Query class
 */
export class Query {
  private client: FirestoreClient;
  private collectionPath: string;
  private allDescendants: boolean;
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
    },
    allDescendants: boolean
  ) {
    this.client = client;
    this.collectionPath = collectionPath;
    this._queryConstraints = constraints;
    this.allDescendants = allDescendants;
  }

  /**
   * Add filter condition
   * @param fieldPath Field path
   * @param opStr Operator
   * @param value Value
   * @returns Query instance
   */
  where(fieldPath: string, opStr: string, value: any): Query {
    const query = new Query(
      this.client,
      this.collectionPath,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );

    // Operator conversion
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
   * Add sorting condition
   * @param fieldPath Field path
   * @param directionStr Sort direction ('asc' or 'desc')
   * @returns Query instance
   */
  orderBy(fieldPath: string, directionStr: "asc" | "desc" = "asc"): Query {
    const query = new Query(
      this.client,
      this.collectionPath,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.orderBy = fieldPath;
    query._queryConstraints.orderDirection =
      directionStr === "asc" ? "ASCENDING" : "DESCENDING";
    return query;
  }

  /**
   * Set limit on number of results
   * @param limit Maximum number
   * @returns Query instance
   */
  limit(limit: number): Query {
    const query = new Query(
      this.client,
      this.collectionPath,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.limit = limit;
    return query;
  }

  /**
   * Set number of documents to skip
   * @param offset Number to skip
   * @returns Query instance
   */
  offset(offset: number): Query {
    const query = new Query(
      this.client,
      this.collectionPath,
      {
        ...this._queryConstraints,
      },
      this.allDescendants
    );
    query._queryConstraints.offset = offset;
    return query;
  }

  /**
   * Execute query
   * @returns QuerySnapshot instance
   */
  async get(): Promise<QuerySnapshot> {
    const results = await this.client.query(
      this.collectionPath,
      this._queryConstraints,
      this.allDescendants
    );
    return new QuerySnapshot(results);
  }
}

/**
 * Query result class
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
   * Array of documents in the result
   */
  get docs(): DocumentSnapshot[] {
    return this._docs;
  }

  /**
   * Whether the result is empty
   */
  get empty(): boolean {
    return this._docs.length === 0;
  }

  /**
   * Number of results
   */
  get size(): number {
    return this._docs.length;
  }

  /**
   * Execute callback for each document
   * @param callback Callback function to execute for each document
   */
  forEach(callback: (result: DocumentSnapshot) => void): void {
    this._docs.forEach(callback);
  }
}

/**
 * Document snapshot class
 */
export class DocumentSnapshot {
  private _id: string;
  private _data: Record<string, any> | null;

  constructor(id: string, data: Record<string, any> | null) {
    this._id = id;
    this._data = data;
  }

  /**
   * Document ID
   */
  get id(): string {
    return this._id;
  }

  /**
   * Whether the document exists
   */
  get exists(): boolean {
    return this._data !== null;
  }

  /**
   * Get document data
   * @returns Document data (undefined if it doesn't exist)
   */
  data(): Record<string, any> | undefined {
    return this._data || undefined;
  }
}

/**
 * Write result class
 */
export class WriteResult {
  /**
   * Write timestamp
   */
  readonly writeTime: Date;

  constructor() {
    this.writeTime = new Date();
  }
}

/**
 * Create a new Firestore client instance
 * @param config Firestore configuration object
 * @returns FirestoreClient instance
 *
 * @example
 * // Connect to default database
 * const db = createFirestoreClient({
 *   projectId: 'your-project-id',
 *   privateKey: 'your-private-key',
 *   clientEmail: 'your-client-email'
 * });
 *
 * // Connect to a different named database
 * const customDb = createFirestoreClient({
 *   projectId: 'your-project-id',
 *   privateKey: 'your-private-key',
 *   clientEmail: 'your-client-email',
 *   databaseId: 'your-database-id'
 * });
 *
 * // Connect to local emulator (no auth required)
 * const emulatorDb = createFirestoreClient({
 *   projectId: 'demo-project',
 *   useEmulator: true,
 *   emulatorHost: '127.0.',
 *   emulatorPort: 8080,
 *   debug: true // Optional: enables detailed logging
 * });
 */
export function createFirestoreClient(config: FirestoreConfig) {
  // Check private key format
  if (config.privateKey) {
    config = {
      ...config,
      privateKey: formatPrivateKey(config.privateKey),
    };
  }
  return new FirestoreClient(config);
}
