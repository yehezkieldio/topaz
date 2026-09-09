import "server-only";
import { z } from "zod";

import type { db as dbClient } from "@/server/db/client";

import { getDeviceIdentity } from "./device-identity";
import type { OplogEntry } from "./oplog";
import { signPayload } from "./protocol";

const syncResponseSchema = z.object({
  nextHlc: z.string().nullable(),
  rows: z.array(
    z.object({
      columnDiffs: z.record(z.string(), z.unknown()),
      deviceId: z.string(),
      hlcTimestamp: z.string(),
      rowId: z.string(),
      seq: z.number(),
      tableName: z.string(),
      tombstone: z.boolean(),
    })
  ),
});

export interface SyncPeer {
  tailnetHostname: string;
  port: number;
  lastSyncedHlc: string | null;
}

export interface PullResult {
  rows: OplogEntry[];
  nextHlc: string | null;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * One pull round against a single paired peer (08_sync/01_transport_and_pairing.md):
 * signs the request as this device, asks the peer's /api/sync for
 * everything since our checkpoint of them, and returns the raw result.
 *
 * Deliberately does not touch known_peer.lastSyncedHlc or apply anything to
 * local tables -- advancing the checkpoint before the returned rows are
 * durably applied would risk losing them if the apply step fails or isn't
 * built yet (it isn't, as of this module -- see the sync round that will
 * wrap this function). A peer that's unreachable (asleep, off the tailnet
 * right now) throws; the caller decides whether that's fatal for this round
 * or just means skipping this one peer this time.
 */
export const pullFromPeer = async (
  db: typeof dbClient,
  peer: SyncPeer
): Promise<PullResult> => {
  const identity = await getDeviceIdentity(db);
  const requestBody = {
    deviceId: identity.deviceId,
    sinceHlc: peer.lastSyncedHlc,
  };
  const signature = await signPayload(identity.privateKey, requestBody);

  // Plain http, not https: Tailscale's own WireGuard tunnel already
  // encrypts everything between paired devices on the tailnet
  // (02_stack/00_stack_contract.md) -- a second TLS layer with certificates
  // to manage on a personal 3-device network adds nothing this app needs.
  const response = await fetch(
    `http://${peer.tailnetHostname}:${peer.port}/api/sync`,
    {
      body: JSON.stringify({ ...requestBody, signature }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Sync pull from ${peer.tailnetHostname} failed: HTTP ${response.status}`
    );
  }

  const parsed = syncResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(
      `Sync pull from ${peer.tailnetHostname} returned a malformed response.`
    );
  }

  return parsed.data;
};
