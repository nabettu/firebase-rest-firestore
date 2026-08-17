import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFirestoreClient } from "../src/client";

// Stub token generation so the production-mode case needs no real credentials.
vi.mock("../src/utils/auth", () => ({
  getFirestoreToken: vi.fn().mockResolvedValue("prod-token"),
}));

/**
 * Regression tests for request-header handling (PR #10).
 *
 * `createWithId()` used to attach `Authorization: Bearer emulator-fake-token`
 * unconditionally, which the Firestore emulator rejects. It must go through
 * `prepareHeaders()` like every other method: no Authorization header in
 * emulator mode, `Bearer <token>` in production mode.
 *
 * These tests stub global fetch, so they run without the emulator or
 * credentials and belong to the unit suite.
 */

const documentResponse = {
  name: "projects/test-project/databases/(default)/documents/items/item1",
  fields: { title: { stringValue: "hello" } },
  createTime: "2026-01-01T00:00:00.000000Z",
  updateTime: "2026-01-01T00:00:00.000000Z",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => documentResponse,
    text: async () => JSON.stringify(documentResponse),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function headersOfLastCall(): Record<string, string> {
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return init.headers ?? {};
}

describe("createWithId request headers", () => {
  it("omits the Authorization header in emulator mode", async () => {
    const client = createFirestoreClient({
      projectId: "test-project",
      privateKey: "",
      clientEmail: "",
      useEmulator: true,
    });

    await client.createWithId("items", "item1", { title: "hello" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(url).toContain("http://127.0.0.1:8080/");
    const headers = headersOfLastCall();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("sends the Bearer token in production mode", async () => {
    const client = createFirestoreClient({
      projectId: "test-project",
      privateKey: "dummy-key",
      clientEmail: "dummy@example.com",
    });

    await client.createWithId("items", "item1", { title: "hello" });

    const headers = headersOfLastCall();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer prod-token");
  });
});
