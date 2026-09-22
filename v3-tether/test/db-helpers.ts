import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  session as sessionTable,
  user as userTable,
} from "@/server/db/schema/auth";

const SESSION_TTL_MS = 1000 * 60 * 60;

// Children before parents -- SQLite has no TRUNCATE ... CASCADE, so deletion
// order does the job explicitly. Identity/autoincrement has nothing to reset
// (ids are generated UUID strings, not autoincrementing integers).
const APP_TABLES_CHILD_TO_PARENT = [
  "work_taxonomy_effective",
  "work_taxonomy_assignment",
  "taxonomy_relation",
  "taxonomy_term",
  "audit_log",
  "work_source_observation",
  "reading_event",
  "reading_state",
  "library_entry",
  "work_contributor",
  "work_source",
  "work",
  "contributor",
  "session",
  "account",
  "user",
] as const;

/**
 * Clears every app table between tests, keeping the reference data
 * (taxonomy_kind, source_platform) global-setup seeds -- those are looked
 * up by slug in production code and are cheap to leave standing.
 *
 * Known gap, deliberately not closed here: this deletes `work` and
 * `taxonomy_term` rows directly, not through removeWorkFromFts/
 * removeTermFromFts, so it leaves their FTS5 index entries
 * (work_fts/taxonomy_term_fts, server/db/search-index.ts) orphaned rather
 * than cleared. Adding a matching `delete from work_fts` (etc.) here was
 * tried and reverted: under this suite's per-file worker parallelism (11
 * workers against one shared topaz_test.db), it reliably corrupted the
 * FTS5 shadow index (`SQLITE_CORRUPT_VTAB`), which is strictly worse than
 * the orphaned-entries gap it was meant to close. The 104 tests currently
 * passing don't exercise FTS MATCH against accumulated cross-test
 * pollution within one suite run, so this hasn't surfaced as a real
 * failure -- but a future test that does search assertions across many
 * work/taxonomy_term-creating tests in the same file should know this
 * isn't actually clean, and rebuilding topaz_test.db from scratch (`rm
 * topaz_test.db*`) is the safe way to get a genuinely fresh index if one
 * ever needs it.
 */
export const truncateAppData = async () => {
  for (const table of APP_TABLES_CHILD_TO_PARENT) {
    // Table names come only from the fixed list above, not external input --
    // sql.raw is safe here. Sequential, not Promise.all, because deletion
    // order (children before parents) is load-bearing under foreign keys.
    // biome-ignore lint/performance/noAwaitInLoops: ordering across statements is required, not incidental
    await db.run(sql.raw(`delete from "${table}"`));
  }
};

export const createTestUser = async (role: "admin" | "user" = "admin") => {
  const id = createId();
  const [row] = await db
    .insert(userTable)
    .values({
      email: `${id}@test.local`,
      emailVerified: true,
      id,
      name: `Test ${role}`,
      role,
    })
    .returning();
  return row;
};

/**
 * Inserts a real session row and returns Authorization-Bearer headers for
 * it -- the bearer plugin (enabled in src/lib/auth.ts) lets auth.api
 * .getSession() resolve a session by its raw token via the DB adapter
 * directly, without needing to replicate better-auth's signed-cookie
 * format outside a real OAuth login flow.
 */
export const createAuthHeaders = async (userId: string) => {
  const token = createId();
  await db.insert(sessionTable).values({
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    id: createId(),
    token,
    userId,
  });
  return new Headers({ authorization: `Bearer ${token}` });
};
