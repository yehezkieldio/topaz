import { config } from "dotenv";
/**
 * Manual retention script -- never a cron job (v3-tether/plan-work.md Slice E).
 * Deletes work_source_observation rows older than 2 years. Refuses to run
 * (logs + exits 0) if the table is already below the row-count threshold,
 * since pruning below that point isn't worth a VACUUM. Run via:
 *
 *   bun run prune-observations
 *
 * After a real prune, run `VACUUM;` manually -- this script only deletes
 * rows, it never vacuums (SQLite's VACUUM operates on the whole file, not
 * per-table the way Postgres's VACUUM (ANALYZE) table_name does).
 */
import { lt } from "drizzle-orm";

config({ path: ".env.local" });

// SQLite has no per-table size introspection without the dbstat virtual
// table, which isn't compiled into Bun's bundled SQLite build -- a row
// count is used as the threshold instead of a byte size. ~150 bytes/row
// (v3-tether/plan-work.md's per-row size math) puts 65,000 rows at
// roughly the same 10MB mark the original threshold targeted.
const ROW_COUNT_THRESHOLD = 65_000;
const RETENTION_MS = 1000 * 60 * 60 * 24 * 365 * 2; // 2 years

const main = async () => {
  const { closeDbConnection, db } = await import("@/server/db/client");
  const { workSourceObservation } = await import("@/server/db/schema");
  const { count } = await import("drizzle-orm");

  const [row] = await db
    .select({ value: count() })
    .from(workSourceObservation);
  const rowCount = row?.value ?? 0;

  if (rowCount < ROW_COUNT_THRESHOLD) {
    // biome-ignore lint/suspicious/noConsole: local one-shot CLI script
    console.log(
      `work_source_observation has ${rowCount} rows, below the ` +
        `${ROW_COUNT_THRESHOLD}-row threshold -- nothing to prune.`
    );
    await closeDbConnection();
    return;
  }

  const cutoff = new Date(Date.now() - RETENTION_MS);
  const deleted = await db
    .delete(workSourceObservation)
    .where(lt(workSourceObservation.createdAt, cutoff))
    .returning({ id: workSourceObservation.id });

  // biome-ignore lint/suspicious/noConsole: local one-shot CLI script
  console.log(
    `Deleted ${deleted.length} rows older than 2 years. Run VACUUM; next.`
  );
  await closeDbConnection();
};

await main();
