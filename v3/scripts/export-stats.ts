/**
 * L4 export: writes tmp/stats-export.json, one row per work, for local
 * notebook/ML exploration. Local-only (never a Route Handler) -- run via:
 *
 *   bun run export-stats
 */
import { mkdir, writeFile } from "node:fs/promises";

import { config } from "dotenv";

config({ path: ".env.local" });

const OUTPUT_PATH = "tmp/stats-export.json";

const main = async () => {
  const { closeDbConnection } = await import("@/server/db/client");
  const { getMlExport } = await import("@/features/stats/server/export");

  const rows = await getMlExport();
  await mkdir("tmp", { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(rows, null, 2));
  // biome-ignore lint/suspicious/noConsole: local one-shot CLI script
  console.log(`Wrote ${rows.length} rows to ${OUTPUT_PATH}`);
  await closeDbConnection();
};

await main();
