import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const databasePath = process.env.DATABASE_PATH;
if (!databasePath) {
  throw new Error("DATABASE_PATH is not set (checked .env.local).");
}

export default defineConfig({
  casing: "snake_case",
  dbCredentials: {
    url: databasePath,
  },
  dialect: "sqlite",
  out: "./drizzle",
  schema: "./src/server/db/schema/index.ts",
});
