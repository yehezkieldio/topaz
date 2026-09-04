import { config } from "dotenv";
import { defineConfig } from "vitest/config";

const { parsed } = config({ path: ".env.test" });
const rootDir = `${import.meta.dirname}/`;

export default defineConfig({
  resolve: {
    alias: {
      "@": `${rootDir}src`,
      "server-only": `${rootDir}test/stubs/server-only.ts`,
    },
  },
  test: {
    env: parsed,
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**"],
    // All test files share one Postgres DB and truncate it in beforeEach --
    // running files in parallel races truncation against fixture inserts
    // from another file's in-flight test.
    fileParallelism: false,
    globalSetup: "./test/global-setup.ts",
    hookTimeout: 30_000,
    include: ["src/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15_000,
  },
});
