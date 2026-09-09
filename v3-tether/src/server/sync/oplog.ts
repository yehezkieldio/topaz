import "server-only";
import { desc, eq } from "drizzle-orm";

import { db as dbClient } from "@/server/db/client";
import { oplog } from "@/server/db/schema/sync";

import { getOrCreateDeviceId } from "./device-id";
import { decodeHlc, encodeHlc, type HlcState, tickLocal } from "./hlc";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0] | typeof dbClient;

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
  const deviceId = await getOrCreateDeviceId(dbClient);

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
