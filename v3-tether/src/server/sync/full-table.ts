import "server-only";
import { asc, gt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import type { db as dbClient } from "@/server/db/client";
import { db } from "@/server/db/client";
import {
  libraryEntry,
  readingState,
  taxonomyTerm,
  work,
  workSource,
} from "@/server/db/schema";

import { getDeviceIdentity } from "./device-identity";
import type { SyncedTableName } from "./digest";
import { signPayload } from "./protocol";

/**
 * Fixed page size for a full-table pull, same reasoning as oplog.ts's
 * SYNC_BATCH_SIZE (07_backend/02_connections_and_scaling_limits.md) -- a
 * library with several thousand entries must not require one unbounded
 * response. Unlike SYNC_BATCH_SIZE, this endpoint is only ever hit for a
 * table Part 1's digest check has already flagged as mismatched, never as
 * a matter of course (08_sync/03_data_integrity_and_reconciliation.md's
 * Part 2: "never pull full table state as a matter of course").
 */
export const PULL_TABLE_BATCH_SIZE = 500;

// Bounds how many pages one full-table read (local or peer) will fetch for
// one table before giving up -- same reasoning as round.ts's
// MAX_ROUNDS_PER_PEER, so a table with an unusually large backlog can't
// stall a repair attempt indefinitely; it just needs another "Repair now"
// click.
const MAX_PAGES_PER_TABLE = 50;

export interface FullTableRow {
  rowId: string;
  version: number | null;
  updatedAtMs: number;
  // Every column except the id column, in the exact shape apply.ts's
  // applyToTable already knows how to consume -- reconciliation (repair.ts)
  // writes a correction through that same function rather than a second,
  // parallel table-write implementation.
  columnDiffs: Record<string, unknown>;
}

interface TableConfig {
  table: SQLiteTable;
  idColumn: SQLiteColumn;
  idKey: string;
  hasVersion: boolean;
}

/**
 * The same closed five-table set apply.ts's per-table switch and digest.ts's
 * SYNCED_TABLES already know about -- idKey/idColumn differ per table
 * (reading_state's primary key is library_entry_id, not id) the same way
 * apply.ts's upsertRow calls already account for. work_source has no
 * version column (digest.ts's own documented decision); hasVersion: false
 * reflects that here too.
 */
const TABLE_CONFIG: Record<SyncedTableName, TableConfig> = {
  library_entry: {
    hasVersion: true,
    idColumn: libraryEntry.id,
    idKey: "id",
    table: libraryEntry,
  },
  reading_state: {
    hasVersion: true,
    idColumn: readingState.libraryEntryId,
    idKey: "libraryEntryId",
    table: readingState,
  },
  taxonomy_term: {
    hasVersion: true,
    idColumn: taxonomyTerm.id,
    idKey: "id",
    table: taxonomyTerm,
  },
  work: {
    hasVersion: true,
    idColumn: work.id,
    idKey: "id",
    table: work,
  },
  work_source: {
    hasVersion: false,
    idColumn: workSource.id,
    idKey: "id",
    table: workSource,
  },
};

/**
 * One page of a table's full row state, ordered by its id column so
 * pagination is stable across pages (07_backend/02_connections_and_scaling_limits.md).
 * This is what the new /api/sync/pull-table endpoint serves, and what a
 * local reconciliation pass reads for "this device's own current state" --
 * same function, same shape, both sides of the diff in repair.ts.
 */
export const fetchTablePage = async (
  tableName: SyncedTableName,
  cursor: string | null,
  limit: number = PULL_TABLE_BATCH_SIZE
): Promise<{ rows: FullTableRow[]; nextCursor: string | null }> => {
  const config = TABLE_CONFIG[tableName];

  // SAFETY: config.idColumn always resolves to a real column on
  // config.table (both come from the same TABLE_CONFIG entry above) -- gt()
  // only returns undefined for a malformed comparison, which this pairing
  // can't produce.
  const rows = await db
    .select()
    .from(config.table)
    .where(gt(config.idColumn, cursor ?? "") as SQL)
    .orderBy(asc(config.idColumn))
    .limit(limit);

  const mapped: FullTableRow[] = rows.map((row) => {
    // SAFETY: every one of the five closed SYNCED_TABLES config.table can
    // resolve to selects into a plain object keyed by that table's own
    // Drizzle column names -- the generic SQLiteTable type on TABLE_CONFIG
    // only erases that at the type level, not at runtime.
    const record = row as Record<string, unknown>;
    // Computed-key destructure (not `delete`) so the id column is dropped
    // from columnDiffs without a dynamic delete -- config.idKey is only
    // ever one of this closed config's own fixed id keys, never
    // attacker-influenced.
    const { [config.idKey]: rowIdValue, ...columnDiffs } = record;
    // SAFETY: idKey always names a NOT NULL text primary/unique key column
    // on this table (idColumns()/readingState.libraryEntryId in schema/).
    const rowId = rowIdValue as string;
    // SAFETY: every synced table spreads timestampColumns(), whose
    // updatedAt is always mode: "timestamp_ms" -- Drizzle deserializes that
    // to a JS Date on every select, never a raw number or string.
    const updatedAt = record.updatedAt as Date;
    // SAFETY: hasVersion is only true for a table whose version column is
    // `integer(...).notNull()` (library_entry/reading_state/taxonomy_term/work).
    const version = config.hasVersion ? (record.version as number) : null;
    return {
      columnDiffs,
      rowId,
      updatedAtMs: updatedAt.getTime(),
      version,
    };
  });

  const last = mapped.at(-1);
  return { nextCursor: last ? last.rowId : null, rows: mapped };
};

/**
 * Pages through this device's entire own state for one table -- the local
 * half of repair.ts's diff, mirroring fetchAllPeerTableRows below but
 * reading directly rather than over HTTP.
 */
export const fetchAllLocalTableRows = async (
  tableName: SyncedTableName
): Promise<FullTableRow[]> => {
  const allRows: FullTableRow[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES_PER_TABLE; page += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each page's cursor depends on the previous page's last row
    const { rows, nextCursor } = await fetchTablePage(tableName, cursor);
    if (rows.length === 0) {
      break;
    }
    allRows.push(...rows);
    cursor = nextCursor;
  }

  return allRows;
};

const pullTableResponseSchema = z.object({
  nextCursor: z.string().nullable(),
  rows: z.array(
    z.object({
      columnDiffs: z.record(z.string(), z.unknown()),
      rowId: z.string(),
      updatedAtMs: z.number(),
      version: z.number().nullable(),
    })
  ),
});

const FETCH_TIMEOUT_MS = 10_000;

export interface PullTablePeer {
  tailnetHostname: string;
  port: number;
}

/**
 * One page of a peer's full table state, signed and verified the same way
 * as digest.ts's fetchPeerDigests and client.ts's pullFromPeer -- same
 * signing, same "peer unreachable throws, caller decides" contract.
 */
const pullTablePageFromPeer = async (
  database: typeof dbClient,
  peer: PullTablePeer,
  table: SyncedTableName,
  cursor: string | null
): Promise<{ rows: FullTableRow[]; nextCursor: string | null }> => {
  const identity = await getDeviceIdentity(database);
  const requestBody = { cursor, deviceId: identity.deviceId, table };
  const signature = await signPayload(identity.privateKey, requestBody);

  const response = await fetch(
    `http://${peer.tailnetHostname}:${peer.port}/api/sync/pull-table`,
    {
      body: JSON.stringify({ ...requestBody, signature }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Table pull (${table}) from ${peer.tailnetHostname} failed: HTTP ${response.status}`
    );
  }

  const parsed = pullTableResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(
      `Table pull (${table}) from ${peer.tailnetHostname} returned a malformed response.`
    );
  }

  return parsed.data;
};

/**
 * Pages through a peer's entire state for one table until it reports no
 * more rows -- only ever called for a table Part 1's digest check has
 * already flagged as mismatched (spec: "never pull full table state as a
 * matter of course; that defeats the entire point of using a cheap digest
 * for the common case").
 */
export const fetchAllPeerTableRows = async (
  database: typeof dbClient,
  peer: PullTablePeer,
  table: SyncedTableName
): Promise<FullTableRow[]> => {
  const allRows: FullTableRow[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES_PER_TABLE; page += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each page's request depends on the previous page's cursor
    const { rows, nextCursor } = await pullTablePageFromPeer(
      database,
      peer,
      table,
      cursor
    );
    if (rows.length === 0) {
      break;
    }
    allRows.push(...rows);
    cursor = nextCursor;
  }

  return allRows;
};
