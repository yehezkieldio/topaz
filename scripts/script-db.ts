import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as progressSchema from "#/server/db/schema/progress";
import * as storySchema from "#/server/db/schema/story";
import * as taxonomySchema from "#/server/db/schema/taxonomy";
import * as userSchema from "#/server/db/schema/user";

const databaseUrl = process.env.DEVELOPMENT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL or DEVELOPMENT_DATABASE_URL is required");
}

export const scriptSql = postgres(databaseUrl, { prepare: false });

export const scriptDb = drizzle(scriptSql, {
    schema: {
        ...progressSchema,
        ...storySchema,
        ...taxonomySchema,
        ...userSchema,
    },
    casing: "snake_case",
    logger: false,
});
