import { config } from "dotenv";
/**
 * One-time manual backfill -- indexes every `work` row created before
 * insertWorkFts/removeWorkFromFts (features/library/server/work-fts.ts)
 * started being called on create/update/delete, so it has no work_fts
 * entry yet and won't surface in library search until this runs. Run via:
 *
 *   bun run backfill-work-fts
 *
 * Deliberately not automatic (server/db/search-index.ts's ensureSearchIndexes
 * doesn't do this on startup): an earlier version did, and running the
 * same idempotent backfill INSERT concurrently from more than one process
 * against the same SQLite file corrupted work_fts's shadow index
 * (`SQLITE_CORRUPT_VTAB`, verified empirically). The app's own
 * single-process-per-device invariant means that can't happen in normal
 * use, but a script an admin runs deliberately, once, doesn't need to
 * depend on that holding forever the way an automatic startup step would.
 * Safe to re-run: only indexes a rowid work_fts doesn't already have.
 */
config({ path: ".env.local" });

const main = async () => {
  const { closeDbConnection, db } = await import("@/server/db/client");
  const { sql } = await import("drizzle-orm");

  const countRow = () =>
    db.get<{ c: number }>(sql`select count(*) as c from work_fts`);

  const before = await countRow();

  await db.run(sql`
    insert into work_fts(rowid, title, description, summary)
    select rowid, title, description, summary from work
    where rowid not in (select rowid from work_fts)
  `);

  const after = await countRow();
  const indexed = (after?.c ?? 0) - (before?.c ?? 0);

  // biome-ignore lint/suspicious/noConsole: local one-shot CLI script
  console.log(
    `work_fts: ${before?.c ?? 0} rows before, ${after?.c ?? 0} after -- ` +
      `indexed ${indexed} previously-unindexed work${indexed === 1 ? "" : "s"}.`
  );
  await closeDbConnection();
};

await main();
