import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Tests for test/scripts/test-with-emulator.sh (`npm run test:emulator`).
 *
 * `vitest` and `nc` are replaced with stubs on PATH, so no emulator is needed.
 * The stub `nc` reports the emulator as already running, which skips the
 * emulator start-up branch of the script.
 */
const SCRIPT = resolve(__dirname, "scripts/test-with-emulator.sh");

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runScript(vitestExitCode: number) {
  const root = mkdtempSync(join(tmpdir(), "test-with-emulator-"));
  dirs.push(root);
  writeFileSync(join(root, ".env"), "FIREBASE_PROJECT_ID=demo-test-project\n");

  const bin = join(root, "bin");
  mkdirSync(bin);
  for (const [name, body] of [
    ["vitest", `echo "vitest $*"; exit ${vitestExitCode}`],
    ["nc", "exit 0"],
  ]) {
    writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }

  return spawnSync("bash", [SCRIPT], {
    cwd: root,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    encoding: "utf8",
  });
}

describe("test-with-emulator.sh", () => {
  it("exits non-zero when the tests fail", () => {
    expect(runScript(1).status).toBe(1);
  });

  it("exits zero when the tests pass", () => {
    expect(runScript(0).status).toBe(0);
  });

  it("runs vitest once instead of in watch mode", () => {
    expect(runScript(0).stdout).toContain("vitest run");
  });
});
