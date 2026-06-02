import { DocumentReference } from "../client"
import { FieldValue } from "../field-value";
import {
  CommitWrite,
  FieldTransform,
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
  if (value instanceof FieldValue) {
    // Sentinels (e.g. serverTimestamp) must be extracted into field transforms
    // before conversion. Reaching here means one was used where Firestore
    // cannot express a transform (such as inside an array).
    throw new Error(
      "FieldValue (e.g. serverTimestamp()) can only be used as a top-level or nested document field value, not inside an array."
    );
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  } else if (value instanceof DocumentReference) {
    return { referenceValue: value.referenceValue };
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
 * Whether a value is a plain JS object (`{}` / `Object.create(null)`), as
 * opposed to a class instance such as `Date`, `DocumentReference`,
 * `LiteralGeoPointValue`, `LiteralDocumentReference`, `FieldValue`, or an array.
 * Only plain objects are recursed into when extracting field transforms.
 */
function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Escape a single field name for use in a Firestore field path. Simple names
 * (`[A-Za-z_][A-Za-z0-9_]*`) are used as-is; anything else (dashes, dots,
 * leading digits, spaces, ...) is wrapped in backticks with `\` and `` ` ``
 * escaped, so a literal dot in a key is treated as part of the name rather than
 * a path separator.
 * See: https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents#Document
 */
function escapeFieldPathSegment(segment: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
    return segment;
  }
  return "`" + segment.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
}

/**
 * Split write data into plain field values and Firestore field transforms.
 *
 * `FieldValue` sentinels (e.g. `serverTimestamp()`) are pulled out into
 * transforms keyed by their (escaped, dot-separated) field path; everything
 * else is left untouched in `fields`. Recursion only descends into plain
 * objects, so class instances (Date / references / geo points) are treated as
 * leaves.
 *
 * @param data Write data (JS values, may contain FieldValue sentinels)
 * @param prefix Field-path prefix used while recursing (internal, pre-escaped)
 */
export function extractFieldTransforms(
  data: Record<string, any>,
  prefix: string = ""
): { fields: Record<string, any>; transforms: FieldTransform[] } {
  const fields: Record<string, any> = {};
  const transforms: FieldTransform[] = [];

  for (const [key, value] of Object.entries(data)) {
    const escapedKey = escapeFieldPathSegment(key);
    const fieldPath = prefix ? `${prefix}.${escapedKey}` : escapedKey;

    if (value instanceof FieldValue) {
      if (value.methodName === "serverTimestamp") {
        transforms.push({ fieldPath, setToServerValue: "REQUEST_TIME" });
      } else {
        throw new Error(`Unsupported FieldValue: ${value.methodName}`);
      }
    } else if (isPlainObject(value)) {
      const nested = extractFieldTransforms(value, fieldPath);
      fields[key] = nested.fields;
      transforms.push(...nested.transforms);
    } else {
      fields[key] = value;
    }
  }

  return { fields, transforms };
}

/**
 * Build a single `documents:commit` write that updates a document and applies
 * field transforms. `updateTransforms` / `currentDocument` are only included
 * when relevant.
 *
 * @param documentName Full resource name (projects/.../documents/<path>)
 * @param fields Already-converted Firestore field values
 * @param transforms Field transforms to apply after the update
 * @param currentDocument Optional precondition (e.g. `{ exists: false }`)
 */
export function buildCommitWrite(
  documentName: string,
  fields: Record<string, FirestoreFieldValue>,
  transforms: FieldTransform[],
  currentDocument?: { exists?: boolean; updateTime?: string }
): CommitWrite {
  const write: CommitWrite = {
    update: { name: documentName, fields },
  };
  if (transforms.length > 0) {
    write.updateTransforms = transforms;
  }
  if (currentDocument) {
    write.currentDocument = currentDocument;
  }
  return write;
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
