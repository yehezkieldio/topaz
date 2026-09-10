import { createClient } from "@libsql/client";

import { drizzle } from "drizzle-orm/libsql";

import { env } from "@/lib/env";

import { ensureSearchIndexes } from "./search-index";
import * as schema from "./schema";

// @libsql/client, not bun:sqlite: bun:sqlite does not survive Next.js's
// jest-worker-based page-data-collection phase (dev *and* build) --
// verified by actually running it, not assumed. @libsql/client is a real
// npm package (on Next's own serverExternalPackages default allow-list)
// with a first-class drizzle-orm/libsql driver; it's SQLite-file-compatible
// and keeps every SQLite-specific piece of this schema (FTS5 trigram,
// json1, math functions) working unchanged. See docs/BUN_SQLITE_NEXT_BUILD.md
// for the full investigation this decision is based on.
const client = createClient({ url: `file:${env.DATABASE_PATH}` });

// Explicit, deliberate ceilings -- never left at SQLite's defaults
// (07_backend/02_connections_and_scaling_limits.md). This runs on the
// admin's own laptop/phone alongside everything else they have open; every
// byte held here is a byte not available to that.
//
// Top-level await, not fire-and-forget: libsql's client API is uniformly
// async (unlike bun:sqlite's synchronous API), so this blocks the module
// from finishing evaluation until pragmas and the FTS5 tables actually
// exist -- every other module that imports `db` is guaranteed these ran
// first, rather than racing a real query against setup still in flight.
await client.execute("PRAGMA journal_mode = WAL;");
await client.execute("PRAGMA synchronous = NORMAL;");
await client.execute("PRAGMA cache_size = -20000;"); // ~20MB page cache
await client.execute("PRAGMA mmap_size = 67108864;"); // 64MB
await client.execute("PRAGMA foreign_keys = ON;");

await ensureSearchIndexes(client);

export const db = drizzle(client, { casing: "snake_case", schema });

// Exposed only so one-shot processes without a framework-managed lifecycle
// (scripts/verify-*.ts) can close the handle and let the process exit --
// application code should never call this.
export const closeDbConnection = () => client.close();
