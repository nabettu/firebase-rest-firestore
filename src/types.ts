/**
 * Firestoreクライアントの設定インターフェース
 */
export interface FirestoreConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  databaseId?: string;
  debug?: boolean;
  useEmulator?: boolean;
  emulatorHost?: string;
  emulatorPort?: number;
}

/**
 * A reference to a document. For example: `projects/{project_id}/databases/{database_id}/documents/{document_path}`.
 * Used to represent document references globally and not connected to any particular client.
 */
export class LiteralDocumentReference {
  referenceValue: string;
  constructor(options: Pick<LiteralDocumentReference, "referenceValue">) {
    this.referenceValue = options.referenceValue;
  }

  /**
   * Globally unique Firestore document reference paths look like:
   *   projects/{project_id}/databases/{database_id}/documents/{document_path}
   * The database id (e.g. `(default)`) never contains a slash, while the
   * document path may contain many. A single anchored regex parses this
   * without pulling in a URLPattern polyfill.
   */
  private static readonly pattern =
    /^projects\/([^/]+)\/databases\/([^/]+)\/documents\/(.+)$/;

  private parse() {
    const match = LiteralDocumentReference.pattern.exec(this.referenceValue);
    if (!match) {
      throw new Error("Invalid document path. Path does not match pattern.");
    }

    const [, project_id, database_id, document_path] = match;
    return { project_id, database_id, document_path };
  }

  /**
   * Get Project ID
   */
  get project_id() {
    return this.parse().project_id;
  }

  /**
   * Get Database ID
   * Ex: `(default)`
   */
  get database_id() {
    return this.parse().database_id;
  }

  /**
   * Get document ID
   */
  get id(): string {
    const path = this.parse().document_path;
    const parts = path.split("/");
    const docId = parts[parts.length - 1];
    return docId
  }

  /**
   * Get the collection ID
   */
  get collectionPath(): string {
    const path = this.parse().document_path;
    const parts = path.split("/");
    const collectionPath = parts.slice(0, parts.length - 1).join("/");
    return collectionPath
  }
  
  /**
   * Get document path
   */
  get path(): string {
    return this.parse().document_path;
  }
}

/**
 * A geo point value representing a point on the surface of Earth.
 */
export class LiteralGeoPointValue {
  geoPointValue: {
    /**
     * The latitude in degrees. It must be in the range [-90.0, +90.0].
     */
    latitude: number,
    /**
     * The longitude in degrees. It must be in the range [-180.0, +180.0].
     */
    longitude: number
  }
  constructor(options: Pick<LiteralGeoPointValue, "geoPointValue">) {
    this.geoPointValue = options.geoPointValue;
  }
}

/**
 * Firestoreの値型定義
 * See: https://github.com/googleapis/google-api-nodejs-client/blob/5870dfe31f4885eebc82c19f7471c50403308f26/src/apis/firestore/v1.ts#L2246
 */
export type FirestoreFieldValue =
  | { stringValue: string }
  | { integerValue: number }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | Pick<LiteralGeoPointValue, 'geoPointValue'>
  | Pick<LiteralDocumentReference, 'referenceValue'>
  | { mapValue: { fields: Record<string, FirestoreFieldValue> } }
  | { arrayValue: { values: FirestoreFieldValue[] } };

/**
 * A Firestore field transform applied server-side during a commit write.
 * See: https://firebase.google.com/docs/firestore/reference/rest/v1/Write#FieldTransform
 */
export interface FieldTransform {
  fieldPath: string;
  setToServerValue: "REQUEST_TIME";
}

/**
 * A single write in a `documents:commit` request.
 */
export interface CommitWrite {
  update: { name: string; fields: Record<string, FirestoreFieldValue> };
  updateTransforms?: FieldTransform[];
  currentDocument?: { exists?: boolean; updateTime?: string };
}

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
  orderDirection?: string;
  limit?: number;
  offset?: number;
}
