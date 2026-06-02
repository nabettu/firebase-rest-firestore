import { URLPattern } from "urlpattern-polyfill"

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
   * The pattern for globally unique Firestore Document Reference paths
   */
  private static pattern = new URLPattern({ pathname: `/projects/:project_id/databases/:database_id/documents/:document_path*`});

  /**
   * Parse using URLPattern, which is a relatively new addition to the standard.
   * See: https://urlpattern.spec.whatwg.org/#dom-urlpattern-protocol
   * Added in Node.js v23: https://nodejs.org/api/url.html#class-urlpattern
   * Baseline 2025 in browsers: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/protocol
   * @returns 
   */
  private parse() {
    const result = LiteralDocumentReference.pattern.exec(`https://hostname/${this.referenceValue}`);
    if (!result) throw new Error("Invalid document path. Path does not match pattern.");

    const project_id = result.pathname.groups["project_id"];
    if (!project_id) throw new Error("Invalid document path. Path does not match pattern.");
    const database_id = result.pathname.groups["database_id"];
    if (!database_id) throw new Error("Invalid document path. Path does not match pattern.");
    const document_path = result.pathname.groups["document_path"];
    if (!document_path) throw new Error("Invalid document path. Path does not match pattern.");

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
