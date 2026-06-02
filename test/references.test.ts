import { describe, it, expect } from "vitest";
import {
  convertToFirestoreValue,
  convertFromFirestoreValue,
} from "../src/utils/converter";
import { createFirestoreClient } from "../src/client";
import { LiteralDocumentReference, LiteralGeoPointValue } from "../src/types";

/**
 * Tests for Firestore document-reference / geo-point value handling.
 *
 * These are dependency-free: building a client and converting values performs
 * no network I/O, so they run without the emulator or credentials.
 *
 * They drive two follow-ups taken over from PR #7:
 *  1. Encode a `DocumentReference` through a public API instead of reaching
 *     into private members (`client["pathUtil"]`).
 *  2. Parse `LiteralDocumentReference` without the `urlpattern-polyfill`
 *     dependency.
 */

function makeClient(databaseId?: string) {
  return createFirestoreClient({
    projectId: "test-project",
    privateKey: "",
    clientEmail: "",
    databaseId,
  });
}

describe("DocumentReference -> referenceValue", () => {
  it("exposes a public referenceValue for the default database", () => {
    const ref = makeClient().doc("users/u1/posts/post1");
    expect(ref.referenceValue).toBe(
      "projects/test-project/databases/(default)/documents/users/u1/posts/post1"
    );
  });

  it("honors a custom databaseId", () => {
    const ref = makeClient("my-db").doc("users/u1");
    expect(ref.referenceValue).toBe(
      "projects/test-project/databases/my-db/documents/users/u1"
    );
  });

  it("encodes a DocumentReference via the public API (no private access)", () => {
    const ref = makeClient().doc("a/b");
    expect(convertToFirestoreValue(ref)).toEqual({
      referenceValue: "projects/test-project/databases/(default)/documents/a/b",
    });
  });
});

describe("LiteralDocumentReference parsing (no urlpattern dependency)", () => {
  const ref =
    "projects/test-project/databases/(default)/documents/users/u1/posts/post1";

  it("parses all components of a nested document path", () => {
    const ldr = new LiteralDocumentReference({ referenceValue: ref });
    expect(ldr.project_id).toBe("test-project");
    expect(ldr.database_id).toBe("(default)");
    expect(ldr.id).toBe("post1");
    expect(ldr.path).toBe("users/u1/posts/post1");
    expect(ldr.collectionPath).toBe("users/u1/posts");
  });

  it("parses a top-level document path", () => {
    const ldr = new LiteralDocumentReference({
      referenceValue: "projects/p/databases/(default)/documents/users/u1",
    });
    expect(ldr.id).toBe("u1");
    expect(ldr.path).toBe("users/u1");
    expect(ldr.collectionPath).toBe("users");
  });

  it("throws on an invalid reference", () => {
    expect(
      () =>
        new LiteralDocumentReference({ referenceValue: "not-a-ref" }).project_id
    ).toThrow(/Invalid document path/);
  });

  it("round-trips through convertToFirestoreValue", () => {
    expect(
      convertToFirestoreValue(
        new LiteralDocumentReference({ referenceValue: ref })
      )
    ).toEqual({ referenceValue: ref });
  });

  it("decodes referenceValue into a LiteralDocumentReference", () => {
    const v = convertFromFirestoreValue({ referenceValue: ref } as any);
    expect(v).toBeInstanceOf(LiteralDocumentReference);
    expect(v.id).toBe("post1");
    expect(v.path).toBe("users/u1/posts/post1");
  });
});

describe("LiteralGeoPointValue", () => {
  it("encodes to geoPointValue", () => {
    expect(
      convertToFirestoreValue(
        new LiteralGeoPointValue({
          geoPointValue: { latitude: 35.6, longitude: 139.7 },
        })
      )
    ).toEqual({ geoPointValue: { latitude: 35.6, longitude: 139.7 } });
  });

  it("decodes geoPointValue into a LiteralGeoPointValue", () => {
    const v = convertFromFirestoreValue({
      geoPointValue: { latitude: 1, longitude: 2 },
    } as any);
    expect(v).toBeInstanceOf(LiteralGeoPointValue);
    expect(v.geoPointValue).toEqual({ latitude: 1, longitude: 2 });
  });
});
