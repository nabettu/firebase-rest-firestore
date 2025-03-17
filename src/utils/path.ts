/**
 * Firestoreのベースパスを取得
 * @param projectId プロジェクトID
 * @param collectionName コレクション名（省略可）
 * @returns Firestoreのベースパス
 */
export function getFirestoreBasePath(
  projectId: string,
  collectionName?: string
): string {
  const basePath = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  return collectionName ? `${basePath}/${collectionName}` : basePath;
}

/**
 * ドキュメントパスからIDを抽出
 * @param path ドキュメントパス
 * @returns ドキュメントID
 */
export function getDocumentId(path?: string): string {
  if (!path) return "";
  const pathParts = path.split("/");
  return pathParts[pathParts.length - 1];
}
