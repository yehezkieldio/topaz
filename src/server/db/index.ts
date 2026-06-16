import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "#/env";
import * as progressSchema from "./schema/progress";
import * as storySchema from "./schema/story";
import * as taxonomySchema from "./schema/taxonomy";
import * as userSchema from "./schema/user";

const schema = {
    ...progressSchema,
    ...storySchema,
    ...taxonomySchema,
    ...userSchema,
};

const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false });
if (env.NODE_ENV !== "production") {
    globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema, casing: "snake_case", logger: false });
