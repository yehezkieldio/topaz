import "server-only";
import { sql } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";

type Tx =
  | Parameters<Parameters<typeof dbClient.transaction>[0]>[0]
  | typeof dbClient;

/**
 * Indexes a work into work_fts (server/db/search-index.ts) for the first
 * time -- call this once, right after the row itself is inserted, never as
 * part of an update. Mirrors taxonomy/server/repository/terms.ts's
 * insertTermFts/removeTermFromFts, the reference implementation
 * search-index.ts's own doc points to for wiring up work/contributor/
 * work_source, which hadn't been done yet before this.
 */
export const insertWorkFts = async (tx: Tx, workId: string): Promise<void> => {
  await tx.run(
    sql`insert into work_fts(rowid, title, description, summary) select rowid, title, description, summary from work where id = ${workId}`
  );
};

/**
 * Removes a work's existing entry from work_fts -- call this BEFORE
 * updating title/description/summary, never after, and never for a row
 * that hasn't been indexed yet. See insertTermFts's doc (terms.ts) for the
 * ordering discipline and the SQLITE_CORRUPT_VTAB failure mode this avoids
 * -- external-content FTS5's DELETE reads the content table's *current*
 * row to compute which trigrams to remove.
 */
export const removeWorkFromFts = async (
  tx: Tx,
  workId: string
): Promise<void> => {
  await tx.run(
    sql`delete from work_fts where rowid = (select rowid from work where id = ${workId})`
  );
};
