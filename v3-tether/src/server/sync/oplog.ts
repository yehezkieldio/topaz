import "server-only";
import { asc, desc, eq, gt } from "drizzle-orm";

import { db as dbClient } from "@/server/db/client";
import { oplog } from "@/server/db/schema/sync";

import { getDeviceIdentity } from "./device-identity";
import {
  decodeHlc,
  encodeHlc,
  type HlcState,
  mergeRemote,
  tickLocal,
} from "./hlc";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0] | typeof dbClient;

/**
 * Fixed per-round cap on oplog rows exchanged in one sync request
 * (07_backend/02_connections_and_scaling_limits.md, 08_sync/00_oplog_and_clock.md's
 * Checkpointing) -- a device that was offline for weeks reconciles across
 * several bounded rounds, not one unbounded pull.
 */
export const SYNC_BATCH_SIZE = 500;

/**
 * This process's device id and HLC state, lazily established once per
 * process rather than read from disk on every write. Module-level by
 * design: there is exactly one process per device (08_sync/02_packaging_and_lifecycle.md
 * -- "opened on demand", not multiple concurrent instances against the same
 * SQLite file), so a single in-memory clock is the whole story, not a
 * simplification that breaks under concurrency this app actually has.
 */
let clockState: { deviceId: string; clock: HlcState } | null = null;
let initPromise: Promise<{ deviceId: string; clock: HlcState }> | null = null;

const loadInitialClockState = async (): Promise<{
  deviceId: string;
  clock: HlcState;
}> => {
  const { deviceId } = await getDeviceIdentity(dbClient);

  const [lastOwnEntry] = await dbClient
    .select({ hlcTimestamp: oplog.hlcTimestamp })
    .from(oplog)
    .where(eq(oplog.deviceId, deviceId))
    .orderBy(desc(oplog.seq))
    .limit(1);

  // Recoverable from the oplog itself, deliberately not a separate
  // persisted "current clock" row -- one source of truth for this device's
  // clock history, not two that could drift apart.
  const clock: HlcState = lastOwnEntry
    ? decodeHlc(lastOwnEntry.hlcTimestamp)
    : { counter: 0, physicalMs: Date.now() };

  return { clock, deviceId };
};

const ensureClockState = async (): Promise<{
  deviceId: string;
  clock: HlcState;
}> => {
  if (clockState) {
    return clockState;
  }
  initPromise ??= loadInitialClockState();
  clockState = await initPromise;
  return clockState;
};

/**
 * Merges an observed remote HLC timestamp (a row received during sync)
 * into this process's clock -- the other half of the HLC receive rule
 * (src/server/sync/hlc.ts's mergeRemote), so this device's own next local
 * write is correctly ordered after anything it just learned about from a
 * peer. Called once per applied oplog row (src/server/sync/apply.ts),
 * regardless of whether that row's data change was itself applied or
 * skipped as stale -- the clock observes the event either way.
 */
export const observeRemoteHlc = async (encoded: string): Promise<void> => {
  const state = await ensureClockState();
  state.clock = mergeRemote(state.clock, decodeHlc(encoded), Date.now());
};

export interface AppendOplogEntryInput {
  tableName: string;
  rowId: string;
  columnDiffs: Record<string, unknown>;
  tombstone?: boolean;
}

/**
 * Advances this device's HLC and appends the resulting oplog row -- the one
 * call every feature mutation that touches a synced table makes, in the
 * same transaction as the row write itself (08_sync/00_oplog_and_clock.md:
 * "one commit produces both the row mutation and its oplog record").
 */
export const appendOplogEntry = async (
  tx: Tx,
  input: AppendOplogEntryInput
): Promise<void> => {
  const state = await ensureClockState();
  const nextClock = tickLocal(state.clock, Date.now());
  state.clock = nextClock;

  await tx.insert(oplog).values({
    columnDiffs: input.columnDiffs,
    deviceId: state.deviceId,
    hlcTimestamp: encodeHlc(nextClock, state.deviceId),
    rowId: input.rowId,
    tableName: input.tableName,
    tombstone: input.tombstone ?? false,
  });
};

export interface OplogEntry {
  seq: number;
  deviceId: string;
  tableName: string;
  rowId: string;
  columnDiffs: Record<string, unknown>;
  hlcTimestamp: string;
  tombstone: boolean;
}

/**
 * This device's own oplog rows with hlc_timestamp strictly greater than
 * `sinceHlc` -- the query the /api/sync Route Handler runs to serve a
 * peer's pull request. Scans the *entire* local oplog (every device_id
 * this device has ever recorded, not just its own), which is what makes
 * sync transitive without a separate checkpoint per origin device
 * (08_sync/00_oplog_and_clock.md's Checkpointing).
 */
export const getOplogEntriesSince = async (
  sinceHlc: string | null,
  limit: number = SYNC_BATCH_SIZE
): Promise<OplogEntry[]> =>
  await dbClient
    .select({
      columnDiffs: oplog.columnDiffs,
      deviceId: oplog.deviceId,
      hlcTimestamp: oplog.hlcTimestamp,
      rowId: oplog.rowId,
      seq: oplog.seq,
      tableName: oplog.tableName,
      tombstone: oplog.tombstone,
    })
    .from(oplog)
    .where(gt(oplog.hlcTimestamp, sinceHlc ?? ""))
    .orderBy(asc(oplog.hlcTimestamp))
    .limit(limit);
