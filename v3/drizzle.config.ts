import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/server/db/schema/index.ts",
});
