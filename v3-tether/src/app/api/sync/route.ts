import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/server/db/client";
import { knownPeer } from "@/server/db/schema/sync";
import { getOplogEntriesSince, SYNC_BATCH_SIZE } from "@/server/sync/oplog";
import { verifySignature } from "@/server/sync/protocol";

/**
 * The one sync endpoint every device runs (08_sync/01_transport_and_pairing.md)
 * -- a peer's pull request against this device's oplog. There is no
 * separate "push" handler: a sync round is this same request made in both
 * directions, each device acting as server for the other's pull.
 *
 * Binding this to the device's Tailscale interface only, not 0.0.0.0, is a
 * deployment-time concern (how the compiled binary is started), not
 * something this Route Handler itself can enforce -- see
 * 08_sync/02_packaging_and_lifecycle.md.
 */
const syncRequestSchema = z.object({
  deviceId: z.string().min(1),
  signature: z.string().min(1),
  sinceHlc: z.string().nullable(),
});

export const POST = async (request: NextRequest) => {
  const parsed = syncRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed sync request." }, { status: 400 });
  }
  const { deviceId, signature, sinceHlc } = parsed.data;

  const [peer] = await db
    .select({ publicKey: knownPeer.publicKey })
    .from(knownPeer)
    .where(eq(knownPeer.deviceId, deviceId))
    .limit(1);

  // No partial trust: an unknown deviceId and a known deviceId with a bad
  // signature get the identical rejection, so a caller can't use the
  // response to enumerate which device ids are paired.
  const isVerified =
    peer &&
    (await verifySignature(peer.publicKey, { deviceId, sinceHlc }, signature));

  if (!isVerified) {
    return NextResponse.json({ error: "Not a paired peer." }, { status: 403 });
  }

  const rows = await getOplogEntriesSince(sinceHlc, SYNC_BATCH_SIZE);
  const nextHlc = rows.at(-1)?.hlcTimestamp ?? sinceHlc;

  return NextResponse.json({ nextHlc, rows });
};
