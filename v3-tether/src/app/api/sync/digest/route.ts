import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/server/db/client";
import { knownPeer } from "@/server/db/schema/sync";
import { computeAllTableDigests } from "@/server/sync/digest";
import { verifySignature } from "@/server/sync/protocol";

/**
 * The digest half of Part 1 detection (08_sync/03_data_integrity_and_reconciliation.md):
 * returns this device's current per-table digests so a peer's sync round
 * can compare them against its own. Copies /api/sync/route.ts's exact
 * verification shape on purpose -- same signed-body pattern, same "unknown
 * peer and bad signature get an identical rejection" discipline, same plain
 * http (Tailscale's own tunnel already encrypts the transport).
 */
const digestRequestSchema = z.object({
  deviceId: z.string().min(1),
  signature: z.string().min(1),
});

export const POST = async (request: NextRequest) => {
  const parsed = digestRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Malformed digest request." },
      { status: 400 }
    );
  }
  const { deviceId, signature } = parsed.data;

  const [peer] = await db
    .select({ publicKey: knownPeer.publicKey })
    .from(knownPeer)
    .where(eq(knownPeer.deviceId, deviceId))
    .limit(1);

  const isVerified =
    peer && (await verifySignature(peer.publicKey, { deviceId }, signature));

  if (!isVerified) {
    return NextResponse.json({ error: "Not a paired peer." }, { status: 403 });
  }

  const digests = await computeAllTableDigests();

  return NextResponse.json({ digests });
};
