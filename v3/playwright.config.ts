import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

const { parsed } = config({ path: ".env.test" });

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  fullyParallel: false,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "list",
  testDir: "./e2e",
  timeout: 90_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    // `next dev` refuses to start a second instance in this project
    // directory even on a different port (its dev lockfile is per-project,
    // not per-port) -- a real local dev server may already be running on
    // :3000, so e2e uses a production server against the test env/DB
    // instead of contending for the dev lock.
    command: `bun run build && bun run start --port ${PORT}`,
    env: {
      ...parsed,
      BETTER_AUTH_URL: BASE_URL,
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: BASE_URL,
  },
  workers: 1,
});
