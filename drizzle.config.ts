import type { Config } from "drizzle-kit";

export default {
    casing: "snake_case",
    dbCredentials: {
        url: process.env.DATABASE_URL ?? "",
    },
    dialect: "postgresql",
    schema: "./src/server/db/schema/index.ts",
    tablesFilter: ["topaz_*"],
} satisfies Config;
