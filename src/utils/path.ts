import { FirestoreConfig } from "../types";

/**
 * Utility class for constructing Firestore URIs
 * Consistently handles different types of paths and operations
 */
export class FirestorePath {
  private projectId: string;
  private databaseId: string;
  private useEmulator: boolean = false;
  private emulatorHost: string = "localhost";
  private emulatorPort: number = 8080;
  private debug: boolean = false;

  /**
   * Constructor
   */
  constructor(config: FirestoreConfig, debug: boolean = false) {
    this.projectId = config.projectId;
    this.databaseId = config.databaseId || "(default)";
    this.debug = debug;
    
    if (config.useEmulator) {
      this.useEmulator = true;
      this.emulatorHost = config.emulatorHost || "localhost";
      this.emulatorPort = config.emulatorPort || 8080;
    }
  }

  /**
   * Get Firestore base URL (without document path)
   */
  getBasePath(): string {
    const baseUrl = this.useEmulator 
      ? `http://${this.emulatorHost}:${this.emulatorPort}/v1` 
      : "https://firestore.googleapis.com/v1";
      
    const path = `${baseUrl}/projects/${this.projectId}/databases/${this.databaseId}/documents`;
    
    if (this.debug) {
      console.log(`Generated base path: ${path}`);
    }
    
    return path;
  }

  /**
   * Get base URL + collection path for a collection root
   * @param path Collection path (ex: "users" or "users/uid/posts")
   */
  getCollectionPath(path: string): string {
    // Remove leading and trailing slashes
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    
    const fullPath = `${this.getBasePath()}/${cleanPath}`;
    
    if (this.debug) {
      console.log(`Generated collection path: ${fullPath}`);
    }
    
    return fullPath;
  }

  /**
   * Get the complete URL for a document
   * @param collectionPath Collection path
   * @param documentId Document ID
   */
  getDocumentPath(collectionPath: string, documentId: string): string {
    const cleanCollectionPath = collectionPath.replace(/^\/+|\/+$/g, '');
    const path = `${this.getBasePath()}/${cleanCollectionPath}/${documentId}`;
    
    if (this.debug) {
      console.log(`Generated document path: ${path}`);
    }
    
    return path;
  }

  /**
   * Get URL for query execution
   * @param path Collection path (ex: "users" or "users/uid/posts")
   * @returns URL for query execution, collection ID, and parent path (if needed)
   */
  getQueryPath(path: string): { 
    url: string; 
    collectionId: string; 
    parentPath?: string;
  } {
    // パスをセグメントに分割
    const segments = path.replace(/^\/+|\/+$/g, '').split('/');
    
    // 単一コレクションの場合
    if (segments.length === 1) {
      const url = `${this.getBasePath()}:runQuery`;
      
      if (this.debug) {
        console.log(`Generated query URL (single collection): ${url}`);
        console.log(`Collection ID: ${segments[0]}`);
      }
      
      return {
        url,
        collectionId: segments[0]
      };
    }
    
    // ネストしたコレクションパスの場合 (例: "users/uid/posts")
    const collectionId = segments[segments.length - 1];
    const parentSegments = segments.slice(0, -1);
    const parentPath = parentSegments.join('/');
    
    // ベースURLでネストしたドキュメントまでのパスを取得
    const url = `${this.getBasePath()}:runQuery`;
    
    if (this.debug) {
      console.log(`Generated query URL (nested collection): ${url}`);
      console.log(`Collection ID: ${collectionId}`);
      console.log(`Parent path: ${parentPath}`);
    }
    
    return {
      url,
      collectionId,
      parentPath
    };
  }
  
  /**
   * Get reference path for parent document (for query construction)
   * @param parentPath Parent document path
   */
  getParentReference(parentPath: string): string {
    return `projects/${this.projectId}/databases/${this.databaseId}/documents/${parentPath}`;
  }

  /**
   * Get URL for runQuery
   * @param collectionPath Collection path
   * @returns URL for executing runQuery
   */
  getRunQueryPath(collectionPath: string): string {
    // コレクションパス情報を取得
    const { collectionId, parentPath } = this.getQueryPath(collectionPath);
    
    // parentPathがある場合は、親ドキュメントパスを使用してURLを作成
    if (parentPath) {
      // getBasePathからベースURLを取得
      const baseUrl = this.getBasePath().replace(/\/documents$/, '');
      
      // 親ドキュメントパスを含むrunQueryのURL
      const runQueryUrl = `${baseUrl}/documents/${parentPath}:runQuery`;
      
      if (this.debug) {
        console.log(`Generated runQuery URL for nested collection: ${runQueryUrl}`);
        console.log(`Collection ID: ${collectionId}`);
      }
      
      return runQueryUrl;
    }
    
    // トップレベルコレクションの場合は、ベースパスを使用
    const baseUrl = this.getBasePath();
    const runQueryUrl = `${baseUrl}:runQuery`;
    
    if (this.debug) {
      console.log(`Generated runQuery URL for top-level collection: ${runQueryUrl}`);
      console.log(`Collection ID: ${collectionId}`);
    }
    
    return runQueryUrl;
  }
}

/**
 * Create an instance of FirestorePath class
 * @param config Firestore configuration
 * @param debug Debug mode
 */
export function createFirestorePath(config: FirestoreConfig, debug: boolean = false): FirestorePath {
  return new FirestorePath(config, debug);
}

/**
 * Get Firestore base path URL (without path)
 * @param projectId Project ID
 * @param databaseId Database ID (defaults to default)
 * @param config Firestore configuration (for emulator settings)
 * @returns Firestore base path URL (without path)
 */
export function getFirestoreBasePath(
  projectId: string,
  databaseId?: string,
  config?: FirestoreConfig
): string {
  // Use emulator URL for emulator mode
  if (config?.useEmulator) {
    const host = config.emulatorHost || "127.0.0.1";
    const port = config.emulatorPort || 8080;
    
    return `http://${host}:${port}/v1/projects/${projectId}/databases/${
      databaseId || "(default)"
    }/documents`;
  }
  
  // Use normal production environment URL
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${
    databaseId || "(default)"
  }/documents`;
}


/**
 * Extract document ID from document path
 * @param path Document path
 * @returns Document ID
 */
export function getDocumentId(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1];
}
