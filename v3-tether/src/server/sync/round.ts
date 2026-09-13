import "server-only";
import { eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { knownPeer } from "@/server/db/schema/sync";

import { applyRemoteOplogRow } from "./apply";
import { pullFromPeer } from "./client";
import { observeRemoteHlc } from "./oplog";

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
    for (const row of rows) {
      // biome-ignore lint/performance/noAwaitInLoops: rows must apply in the HLC order they were returned in, not concurrently
      await applyRemoteOplogRow(tx, row);
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
      const { rowsApplied, nextHlc } = await syncOnceWithPeer(
        db,
        peer,
        cursor
      );
      totalApplied += rowsApplied;
      if (rowsApplied === 0) {
        break;
      }
      cursor = nextHlc;
    }
    return { deviceId: peer.deviceId, rowsApplied: totalApplied, status: "synced" };
  } catch (error) {
    return {
      deviceId: peer.deviceId,
      error: error instanceof Error ? error.message : String(error),
      rowsApplied: totalApplied,
      status: "error",
    };
  }
};

/**
 * One sync attempt against every known peer (08_sync/02_packaging_and_lifecycle.md
 * -- run on app open/close, not on a background timer or socket). Peers
 * are synced independently and concurrently: one unreachable peer never
 * blocks or fails the others, matching "devices don't need to be online
 * together."
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

  return await Promise.all(peers.map((peer) => syncWithPeer(db, peer)));
};
