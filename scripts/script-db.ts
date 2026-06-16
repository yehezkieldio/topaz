import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as libraryEntrySchema from "#/server/db/schema/library-entry";
import * as taxonomySchema from "#/server/db/schema/taxonomy";
import * as userSchema from "#/server/db/schema/user";
import * as workSchema from "#/server/db/schema/work";

const databaseUrl = process.env.DEVELOPMENT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL or DEVELOPMENT_DATABASE_URL is required");
}

export const scriptSql = postgres(databaseUrl, { prepare: false });

export const scriptDb = drizzle(scriptSql, {
    schema: {
        ...libraryEntrySchema,
        ...taxonomySchema,
        ...userSchema,
        ...workSchema,
    },
    casing: "snake_case",
    logger: false,
});
