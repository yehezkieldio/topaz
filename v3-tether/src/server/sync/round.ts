import "server-only";
import { eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { knownPeer } from "@/server/db/schema/sync";

import { applyRemoteOplogRow, getLatestLocalHlcByRow } from "./apply";
import { pullFromPeer } from "./client";
import { compactOplogIfNeeded } from "./compaction";
import { checkIntegrityWithPeer } from "./digest";
import { observeRemoteHlc } from "./oplog";
import { repairMismatchedTablesWithPeer } from "./repair";

interface KnownPeerRow {
  deviceId: string;
  tailnetHostname: string;
  port: number;
  lastSyncedHlc: string | null;
}

/**
 * One request/response round against a single peer: fetch a bounded batch
 * of their oplog rows since `cursor`, apply each in HLC order inside one
 * transaction, and only then advance known_peer.last_synced_hlc -- so a
 * failure partway through an apply never leaves the checkpoint ahead of
 * what was actually durably applied (08_sync/00_oplog_and_clock.md).
 */
const syncOnceWithPeer = async (
  db: typeof dbClient,
  peer: KnownPeerRow,
  cursor: string | null
): Promise<{ rowsApplied: number; nextHlc: string | null }> => {
  const { rows, nextHlc } = await pullFromPeer(db, {
    lastSyncedHlc: cursor,
    port: peer.port,
    tailnetHostname: peer.tailnetHostname,
  });

  if (rows.length === 0) {
    return { nextHlc: cursor, rowsApplied: 0 };
  }

  await db.transaction(async (tx) => {
    // One query for the whole batch's staleness lookup instead of one per
    // row (apply.ts's getLatestLocalHlcByRow doc) -- rows still apply
    // strictly in HLC order below, this only removes the redundant
    // per-row SELECT that order never actually depended on.
    const latestLocalByRow = await getLatestLocalHlcByRow(tx, rows);
    for (const row of rows) {
      // biome-ignore lint/performance/noAwaitInLoops: rows must apply in the HLC order they were returned in, not concurrently
      await applyRemoteOplogRow(tx, row, latestLocalByRow);
      // biome-ignore lint/performance/noAwaitInLoops: the clock must observe each row's HLC in that same order
      await observeRemoteHlc(row.hlcTimestamp);
    }
    await tx
      .update(knownPeer)
      .set({ lastSyncedHlc: nextHlc })
      .where(eq(knownPeer.deviceId, peer.deviceId));
  });

  return { nextHlc, rowsApplied: rows.length };
};

// Bounds how many batches one syncWithPeer call will pull in a row, so a
// peer with a very large backlog can't stall the whole sync attempt
// indefinitely within one app-open/close cycle -- it just needs one more
// cycle to finish catching up (07_backend/02_connections_and_scaling_limits.md).
const MAX_ROUNDS_PER_PEER = 20;

export interface PeerSyncOutcome {
  deviceId: string;
  status: "synced" | "error";
  rowsApplied: number;
  error?: string;
}

/**
 * Repeats syncOnceWithPeer against one peer until it reports no more rows
 * (fully caught up) or MAX_ROUNDS_PER_PEER is hit -- a device that was
 * closed for weeks catches up across several bounded rounds in one sitting
 * rather than needing that many separate app opens. Never throws: a
 * network failure (peer asleep, off the tailnet) or an apply failure both
 * surface as `{status: "error"}` so the caller can keep going with its
 * other peers (08_sync/01_transport_and_pairing.md: "the sync attempt for
 * that peer this round simply fails silently and is retried next time").
 */
export const syncWithPeer = async (
  db: typeof dbClient,
  peer: KnownPeerRow
): Promise<PeerSyncOutcome> => {
  let cursor = peer.lastSyncedHlc;
  let totalApplied = 0;

  try {
    for (let round = 0; round < MAX_ROUNDS_PER_PEER; round += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: each round's request depends on the previous round's checkpoint
      const { rowsApplied, nextHlc } = await syncOnceWithPeer(db, peer, cursor);
      totalApplied += rowsApplied;
      if (rowsApplied === 0) {
        break;
      }
      cursor = nextHlc;
    }
    return {
      deviceId: peer.deviceId,
      rowsApplied: totalApplied,
      status: "synced",
    };
  } catch (error) {
    return {
      deviceId: peer.deviceId,
      error: error instanceof Error ? error.message : String(error),
      rowsApplied: totalApplied,
      status: "error",
    };
  }
};

// Comparing digests touches every row of every synced table, not just rows
// changed since the last checkpoint -- strictly heavier than a normal
// oplog pull (08_sync/03_data_integrity_and_reconciliation.md's Part 1), so
// it runs on a lower-frequency trigger rather than every round. This
// in-memory counter (reset on process restart, same as oplog.ts's clock
// cache) is enough given "there is exactly one process per device" and a
// sync round already only fires on app open/close, not a timer -- losing
// count across a restart just means the next open's round counts as 1
// again, not a correctness problem.
const INTEGRITY_CHECK_EVERY_N_ROUNDS = 10;
let roundsSinceLastIntegrityCheck = 0;

/**
 * One sync attempt against every known peer (08_sync/02_packaging_and_lifecycle.md
 * -- run on app open/close, not on a background timer or socket). Peers
 * are synced independently and concurrently: one unreachable peer never
 * blocks or fails the others, matching "devices don't need to be online
 * together."
 *
 * Every INTEGRITY_CHECK_EVERY_N_ROUNDS-th round, also runs a digest
 * comparison against each peer after the normal oplog exchange completes
 * (08_sync/03_data_integrity_and_reconciliation.md's Part 1), and, on the
 * same cadence, an oplog-size check that compacts the log if it has grown
 * past compaction.ts's threshold. A digest mismatch triggers an automatic
 * repair against that peer immediately (repair.ts's
 * repairMismatchedTablesWithPeer, guarded against overlapping a concurrent
 * manual "Repair now" click on the same peer). All three -- the check, the
 * repair, and the compaction -- are separate from, and never block or are
 * blocked by, the oplog sync above: any failure among them is recorded for
 * the UI to surface (or, for repair/compaction, simply swallowed the way an
 * unreachable peer already was), never thrown, so none of them can turn a
 * healthy oplog sync into a reported failure. The manual "Check integrity
 * now", "Repair now", and "Compact oplog" actions (actions.ts) still work
 * the same as before, unchanged -- this is additive automation on top of
 * them, run on a periodic cadence instead of waiting for a click.
 */
export const syncWithAllKnownPeers = async (
  db: typeof dbClient
): Promise<PeerSyncOutcome[]> => {
  const peers = await db
    .select({
      deviceId: knownPeer.deviceId,
      lastSyncedHlc: knownPeer.lastSyncedHlc,
      port: knownPeer.port,
      tailnetHostname: knownPeer.tailnetHostname,
    })
    .from(knownPeer);

  const outcomes = await Promise.all(
    peers.map((peer) => syncWithPeer(db, peer))
  );

  roundsSinceLastIntegrityCheck += 1;
  if (roundsSinceLastIntegrityCheck >= INTEGRITY_CHECK_EVERY_N_ROUNDS) {
    roundsSinceLastIntegrityCheck = 0;
    await Promise.all(
      peers.map(async (peer) => {
        try {
          const result = await checkIntegrityWithPeer(db, peer);
          if (result.mismatchedTables.length > 0) {
            await repairMismatchedTablesWithPeer(
              db,
              peer,
              result.mismatchedTables,
              "auto"
            );
          }
        } catch {
          // A peer being unreachable, the check itself failing, or an
          // automatic repair failing (including losing the in-flight guard
          // race to a concurrent manual "Repair now" click) is not a
          // sync-round failure -- checkIntegrityWithPeer and
          // repairMismatchedTablesWithPeer already recorded whatever they
          // could; nothing else to do here.
        }
      })
    );
    await compactOplogIfNeeded(db).catch(() => {
      // Same restraint as the integrity/repair block above -- a compaction
      // failure (including losing the in-flight guard race to a concurrent
      // manual "Compact oplog" click) never turns a healthy sync round into
      // a reported failure.
    });
  }

  return outcomes;
};

/**
 * The UI's manual "Check integrity" trigger (spec's Part 1: "every Nth
 * round, on a manual button, or both" -- this is the "both" half,
 * alongside the periodic check folded into syncWithAllKnownPeers above).
 * Runs immediately against every known peer, bypassing the round counter,
 * and never throws for an individual peer -- one unreachable peer's check
 * failing doesn't stop the others from completing.
 */
export const checkIntegrityWithAllKnownPeers = async (
  db: typeof dbClient
): Promise<void> => {
  const peers = await db
    .select({
      deviceId: knownPeer.deviceId,
      port: knownPeer.port,
      tailnetHostname: knownPeer.tailnetHostname,
    })
    .from(knownPeer);

  await Promise.all(
    peers.map((peer) =>
      checkIntegrityWithPeer(db, peer).catch(() => {
        // A peer being unreachable or the check itself failing is not a
        // sync-round failure -- checkIntegrityWithPeer already recorded
        // whatever it could; nothing else to do here.
      })
    )
  );
};
