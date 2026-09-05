import { config } from "dotenv";
/**
 * Manual retention script -- never a cron job (v3/plan-work.md Slice E).
 * Deletes work_source_observation rows older than 2 years. Refuses to run
 * (logs + exits 0) if the table is already below the size threshold, since
 * pruning below that point isn't worth a VACUUM. Run via:
 *
 *   bun run prune-observations
 *
 * After a real prune, run `VACUUM (ANALYZE) work_source_observation;`
 * manually -- this script only deletes rows, it never vacuums.
 */
import { sql } from "drizzle-orm";

config({ path: ".env.local" });

// 10 MB
const SIZE_THRESHOLD_BYTES = 10 * 1024 * 1024;
const RETENTION_INTERVAL = "2 years";

const main = async () => {
  const { closeDbConnection, db } = await import("@/server/db/client");

  const [{ size_bytes: sizeBytes }] = await db.execute<{
    size_bytes: string;
  }>(
    sql`select pg_total_relation_size('work_source_observation') as size_bytes`
  );

  if (Number(sizeBytes) < SIZE_THRESHOLD_BYTES) {
    // biome-ignore lint/suspicious/noConsole: local one-shot CLI script
    console.log(
      `work_source_observation is ${sizeBytes} bytes, below the ` +
        `${SIZE_THRESHOLD_BYTES} byte threshold -- nothing to prune.`
    );
    await closeDbConnection();
    return;
  }

  const deleted = (await db.execute(sql`
    delete from work_source_observation
    where created_at < now() - interval '${sql.raw(RETENTION_INTERVAL)}'
  `)) as unknown as { count: number };

  // biome-ignore lint/suspicious/noConsole: local one-shot CLI script
  console.log(
    `Deleted ${deleted.count} rows older than ${RETENTION_INTERVAL}. ` +
      "Run VACUUM (ANALYZE) work_source_observation; next."
  );
  await closeDbConnection();
};

await main();
