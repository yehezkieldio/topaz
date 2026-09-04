import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

const conn = postgres(env.DATABASE_URL, { max: 1, prepare: false });

export const db = drizzle(conn, { casing: "snake_case", schema });

// Exposed only so one-shot processes without a framework-managed lifecycle
// (scripts/verify-*.ts) can close the pooled connection and let the process
// exit -- application code should never call this.
export const closeDbConnection = () => conn.end({ timeout: 1 });
