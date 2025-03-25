/**
 * Firestoreのベースパスを取得
 * @param projectId プロジェクトID
 * @param collectionName コレクション名（省略可）
 * @param databaseId データベースID（省略時は'(default)'）
 * @returns Firestoreのベースパス
 */
export function getFirestoreBasePath(
  projectId: string,
  collectionName?: string,
  databaseId?: string
): string {
  const dbId = databaseId || "(default)";
  const basePath = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;
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
