import type { Config } from "drizzle-kit";

export default {
    schema: "./src/server/db/schema/index.ts",
    casing: "snake_case",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL ?? "",
    },
    tablesFilter: ["topaz_*"],
} satisfies Config;
