import type { Config } from "drizzle-kit";
import { env } from "#/env";

export default {
    schema: "./src/server/db/schema/index.ts",
    casing: "snake_case",
    dialect: "postgresql",
    dbCredentials: {
        url: env.DATABASE_URL,
    },
    tablesFilter: ["topaz_*"],
} satisfies Config;
