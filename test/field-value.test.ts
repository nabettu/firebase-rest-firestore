import { describe, it, expect } from "vitest";
import { FieldValue } from "../src/field-value";
import {
  extractFieldTransforms,
  convertToFirestoreValue,
  buildCommitWrite,
} from "../src/utils/converter";
import { createFirestoreClient } from "../src/client";
import { LiteralGeoPointValue } from "../src/types";

/**
 * Dependency-free unit tests for FieldValue.serverTimestamp() support (issue #5).
 * These exercise the pure pieces — the sentinel, transform extraction, the
 * conversion safety-net, and the commit-write body shape — with no network I/O.
 * The actual :commit round-trip is covered by the emulator integration test.
 */

function makeClient() {
  return createFirestoreClient({
    projectId: "p",
    privateKey: "",
    clientEmail: "",
  });
}

describe("FieldValue", () => {
  it("serverTimestamp() returns a FieldValue sentinel", () => {
    const fv = FieldValue.serverTimestamp();
    expect(fv).toBeInstanceOf(FieldValue);
    expect(fv.methodName).toBe("serverTimestamp");
  });

  it("isEqual compares by method", () => {
    expect(
      FieldValue.serverTimestamp().isEqual(FieldValue.serverTimestamp())
    ).toBe(true);
  });
});

describe("extractFieldTransforms", () => {
  it("pulls a top-level serverTimestamp into transforms", () => {
    const { fields, transforms } = extractFieldTransforms({
      name: "a",
      createdAt: FieldValue.serverTimestamp(),
    });
    expect(fields).toEqual({ name: "a" });
    expect(transforms).toEqual([
      { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
    ]);
  });

  it("produces a dotted fieldPath for nested sentinels and keeps the surrounding map", () => {
    const { fields, transforms } = extractFieldTransforms({
      meta: { v: 1, updatedAt: FieldValue.serverTimestamp() },
    });
    expect(fields).toEqual({ meta: { v: 1 } });
    expect(transforms).toEqual([
      { fieldPath: "meta.updatedAt", setToServerValue: "REQUEST_TIME" },
    ]);
  });

  it("handles multiple sentinels at different depths", () => {
    const { fields, transforms } = extractFieldTransforms({
      a: FieldValue.serverTimestamp(),
      b: { c: FieldValue.serverTimestamp() },
    });
    expect(fields).toEqual({ b: {} });
    expect(transforms).toEqual([
      { fieldPath: "a", setToServerValue: "REQUEST_TIME" },
      { fieldPath: "b.c", setToServerValue: "REQUEST_TIME" },
    ]);
  });

  it("returns empty transforms and untouched fields when there are no sentinels", () => {
    const data = {
      name: "x",
      n: 2,
      when: new Date("2026-01-01T00:00:00.000Z"),
      tags: ["a"],
      nested: { y: 1 },
    };
    const { fields, transforms } = extractFieldTransforms(data);
    expect(transforms).toEqual([]);
    expect(fields).toEqual(data);
  });

  it("backtick-escapes non-simple field names", () => {
    const { transforms } = extractFieldTransforms({
      "created-at": FieldValue.serverTimestamp(),
    });
    expect(transforms).toEqual([
      { fieldPath: "`created-at`", setToServerValue: "REQUEST_TIME" },
    ]);
  });

  it("escapes a literal dot in a field name (not treated as a path separator)", () => {
    const { transforms } = extractFieldTransforms({
      meta: { "x.y": FieldValue.serverTimestamp() },
    });
    expect(transforms).toEqual([
      { fieldPath: "meta.`x.y`", setToServerValue: "REQUEST_TIME" },
    ]);
  });

  it("treats Date / DocumentReference / LiteralGeoPointValue as leaves (no recursion)", () => {
    const ref = makeClient().doc("a/b");
    const geo = new LiteralGeoPointValue({
      geoPointValue: { latitude: 1, longitude: 2 },
    });
    const date = new Date("2026-01-01T00:00:00.000Z");
    const { fields, transforms } = extractFieldTransforms({ ref, geo, date });
    expect(transforms).toEqual([]);
    expect(fields.ref).toBe(ref);
    expect(fields.geo).toBe(geo);
    expect(fields.date).toBe(date);
  });
});

describe("convertToFirestoreValue safety net", () => {
  it("throws if a FieldValue reaches conversion directly", () => {
    expect(() => convertToFirestoreValue(FieldValue.serverTimestamp())).toThrow(
      /FieldValue/
    );
  });

  it("throws if a FieldValue is nested inside an array", () => {
    expect(() =>
      convertToFirestoreValue([FieldValue.serverTimestamp()])
    ).toThrow(/FieldValue/);
  });
});

describe("buildCommitWrite", () => {
  const name = "projects/p/databases/(default)/documents/c/d";

  it("builds an update write with transforms", () => {
    const write = buildCommitWrite(
      name,
      { name: { stringValue: "a" } },
      [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }]
    );
    expect(write).toEqual({
      update: { name, fields: { name: { stringValue: "a" } } },
      updateTransforms: [
        { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
      ],
    });
  });

  it("includes the currentDocument precondition when provided", () => {
    const write = buildCommitWrite(name, {}, [], { exists: false });
    expect(write).toEqual({
      update: { name, fields: {} },
      currentDocument: { exists: false },
    });
  });

  it("omits updateTransforms when there are none", () => {
    const write = buildCommitWrite(name, { a: { integerValue: 1 } }, []);
    expect(write).toEqual({
      update: { name, fields: { a: { integerValue: 1 } } },
    });
  });
});
