import { DocumentReference } from "../client"
import {
  FirestoreDocument,
  FirestoreFieldValue,
  FirestoreResponse,
  LiteralDocumentReference,
  LiteralGeoPointValue,
} from "../types";
import { getDocumentId } from "./path";

/**
 * JSの値をFirestore形式に変換する
 * @param value 変換する値
 * @returns Firestore形式の値
 */
export function convertToFirestoreValue(value: any): FirestoreFieldValue {
  // store in temporary variable to enable TypeScript to be more thorough
  let unknown: unknown = value;
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  } else if (value instanceof DocumentReference) {
    return { referenceValue: value["client"]["pathUtil"].getParentReference(value.path) };
  } else if (value instanceof LiteralDocumentReference) {
    return { referenceValue: value.referenceValue }
  } else if (value instanceof LiteralGeoPointValue) {
    return { geoPointValue: value.geoPointValue };
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
 * @param firestoreValue Firestore形式の値
 * @returns JS形式の値
 */
export function convertFromFirestoreValue(
  firestoreValue: FirestoreFieldValue
): any {
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
  } else if ("geoPointValue" in firestoreValue) {
    return new LiteralGeoPointValue(firestoreValue)
  } else if ("referenceValue" in firestoreValue) {
    return new LiteralDocumentReference(firestoreValue);
  } else if ("mapValue" in firestoreValue && firestoreValue.mapValue.fields) {
    return Object.entries(firestoreValue.mapValue.fields).reduce(
      (acc, [key, val]) => ({
        ...acc,
        [key]: convertFromFirestoreValue(val),
      }),
      {}
    );
  } else if ("arrayValue" in firestoreValue) {
    // The `values` field can be undefined, meaning that this is an empty array
    return (firestoreValue.arrayValue.values ?? []).map(convertFromFirestoreValue);
  }

  return null;
}

/**
 * オブジェクトをFirestoreドキュメント形式に変換
 * @param data 変換するオブジェクト
 * @returns Firestoreドキュメント
 */
export function convertToFirestoreDocument(
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
 * @param doc Firestoreレスポンス
 * @returns 変換されたオブジェクト（idプロパティ付き）
 */
export function convertFromFirestoreDocument(
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
