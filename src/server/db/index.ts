import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "#/env";
import * as libraryEntrySchema from "./schema/library-entry";
import * as taxonomySchema from "./schema/taxonomy";
import * as userSchema from "./schema/user";
import * as workSchema from "./schema/work";

const schema = {
    ...libraryEntrySchema,
    ...taxonomySchema,
    ...userSchema,
    ...workSchema,
};

const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false });
if (env.NODE_ENV !== "production") {
    globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema, casing: "snake_case", logger: false });
