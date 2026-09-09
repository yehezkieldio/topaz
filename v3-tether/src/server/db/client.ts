import { Database } from "bun:sqlite";

import { drizzle } from "drizzle-orm/bun-sqlite";

import { env } from "@/lib/env";

import * as schema from "./schema";

const sqlite = new Database(env.DATABASE_PATH, { create: true });

// Explicit, deliberate ceilings -- never left at SQLite's defaults
// (07_backend/02_connections_and_scaling_limits.md). This runs on the
// admin's own laptop/phone alongside everything else they have open; every
// byte held here is a byte not available to that.
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA synchronous = NORMAL;");
sqlite.exec("PRAGMA cache_size = -20000;"); // ~20MB page cache
sqlite.exec("PRAGMA mmap_size = 67108864;"); // 64MB
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { casing: "snake_case", schema });

// Exposed only so one-shot processes without a framework-managed lifecycle
// (scripts/verify-*.ts) can close the handle and let the process exit --
// application code should never call this.
export const closeDbConnection = () => sqlite.close();
