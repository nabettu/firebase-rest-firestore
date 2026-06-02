import { describe, it, expect } from "vitest";
import {
  convertToFirestoreValue,
  convertFromFirestoreValue,
  convertToFirestoreDocument,
  convertFromFirestoreDocument,
} from "../src/utils/converter";

/**
 * Pure unit tests for the value converter.
 *
 * These do NOT require the emulator or any credentials, so they run as a fast
 * baseline. The intent is to lock in the current (main) behavior so that
 * incoming changes (e.g. referenceValue / geoPointValue support in PR #7) can
 * be checked against a known-green state.
 */
describe("convertToFirestoreValue", () => {
  it("converts strings", () => {
    expect(convertToFirestoreValue("hello")).toEqual({ stringValue: "hello" });
  });

  it("converts integers to integerValue", () => {
    expect(convertToFirestoreValue(123)).toEqual({ integerValue: 123 });
    expect(convertToFirestoreValue(0)).toEqual({ integerValue: 0 });
    expect(convertToFirestoreValue(-7)).toEqual({ integerValue: -7 });
  });

  it("converts non-integer numbers to doubleValue", () => {
    expect(convertToFirestoreValue(1.5)).toEqual({ doubleValue: 1.5 });
    expect(convertToFirestoreValue(-0.25)).toEqual({ doubleValue: -0.25 });
  });

  it("converts booleans", () => {
    expect(convertToFirestoreValue(true)).toEqual({ booleanValue: true });
    expect(convertToFirestoreValue(false)).toEqual({ booleanValue: false });
  });

  it("converts null and undefined to nullValue", () => {
    expect(convertToFirestoreValue(null)).toEqual({ nullValue: null });
    expect(convertToFirestoreValue(undefined)).toEqual({ nullValue: null });
  });

  it("converts Date to timestampValue (ISO string)", () => {
    const date = new Date("2026-01-02T03:04:05.000Z");
    expect(convertToFirestoreValue(date)).toEqual({
      timestampValue: "2026-01-02T03:04:05.000Z",
    });
  });

  it("converts arrays to arrayValue", () => {
    expect(convertToFirestoreValue([1, "a", true])).toEqual({
      arrayValue: {
        values: [
          { integerValue: 1 },
          { stringValue: "a" },
          { booleanValue: true },
        ],
      },
    });
  });

  it("converts empty arrays to an empty values list", () => {
    expect(convertToFirestoreValue([])).toEqual({
      arrayValue: { values: [] },
    });
  });

  it("converts plain objects to mapValue", () => {
    expect(convertToFirestoreValue({ a: 1, b: "x" })).toEqual({
      mapValue: {
        fields: {
          a: { integerValue: 1 },
          b: { stringValue: "x" },
        },
      },
    });
  });

  it("converts nested objects and arrays recursively", () => {
    expect(
      convertToFirestoreValue({ tags: ["x"], meta: { n: 2 } })
    ).toEqual({
      mapValue: {
        fields: {
          tags: { arrayValue: { values: [{ stringValue: "x" }] } },
          meta: { mapValue: { fields: { n: { integerValue: 2 } } } },
        },
      },
    });
  });
});

describe("convertFromFirestoreValue", () => {
  it("reads stringValue", () => {
    expect(convertFromFirestoreValue({ stringValue: "hello" })).toBe("hello");
  });

  it("reads integerValue as a number", () => {
    // Firestore returns integers as strings over REST; verify coercion.
    expect(convertFromFirestoreValue({ integerValue: "123" } as any)).toBe(123);
    expect(convertFromFirestoreValue({ integerValue: 123 } as any)).toBe(123);
  });

  it("reads doubleValue", () => {
    expect(convertFromFirestoreValue({ doubleValue: 1.5 })).toBe(1.5);
  });

  it("reads booleanValue", () => {
    expect(convertFromFirestoreValue({ booleanValue: false })).toBe(false);
  });

  it("reads nullValue", () => {
    expect(convertFromFirestoreValue({ nullValue: null })).toBeNull();
  });

  it("reads timestampValue as a Date", () => {
    const result = convertFromFirestoreValue({
      timestampValue: "2026-01-02T03:04:05.000Z",
    });
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  it("reads mapValue recursively", () => {
    expect(
      convertFromFirestoreValue({
        mapValue: {
          fields: {
            a: { integerValue: "1" } as any,
            b: { stringValue: "x" },
          },
        },
      })
    ).toEqual({ a: 1, b: "x" });
  });

  it("reads arrayValue recursively", () => {
    expect(
      convertFromFirestoreValue({
        arrayValue: {
          values: [{ stringValue: "a" }, { integerValue: "2" } as any],
        },
      })
    ).toEqual(["a", 2]);
  });
});

describe("round-trip JS -> Firestore -> JS", () => {
  it("preserves a representative document", () => {
    const original = {
      name: "Test",
      count: 42,
      ratio: 0.5,
      active: true,
      missing: null,
      tags: ["a", "b"],
      nested: { x: 1, y: ["z"] },
    };

    const firestore = convertToFirestoreValue(original);
    const restored = convertFromFirestoreValue(firestore as any);

    expect(restored).toEqual(original);
  });
});

describe("convertToFirestoreDocument / convertFromFirestoreDocument", () => {
  it("wraps fields and round-trips with an id from the document name", () => {
    const data = { name: "Item", value: 10 };
    const doc = convertToFirestoreDocument(data);

    expect(doc).toEqual({
      fields: {
        name: { stringValue: "Item" },
        value: { integerValue: 10 },
      },
    });

    const restored = convertFromFirestoreDocument({
      name: "projects/p/databases/(default)/documents/items/abc123",
      fields: doc.fields,
    } as any);

    expect(restored).toEqual({ name: "Item", value: 10, id: "abc123" });
  });

  it("returns just the id when the document has no fields", () => {
    const restored = convertFromFirestoreDocument({
      name: "projects/p/databases/(default)/documents/items/xyz789",
    } as any);

    expect(restored).toEqual({ id: "xyz789" });
  });
});
