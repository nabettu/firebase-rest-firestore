import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// .env ファイルを読み込む
dotenv.config();

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000,
  },
});
