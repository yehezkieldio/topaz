import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { hasExistingUser } from "@/lib/auth";
import { db } from "@/server/db/client";
import { user as userTable } from "@/server/db/schema/auth";
import { knownPeer } from "@/server/db/schema/sync";
import { verifySignature } from "@/server/sync/protocol";

/**
 * The one-shot counterpart to /api/sync for a brand-new peer that has no
 * local account yet (account-bootstrap.ts). Reuses the exact same
 * signed-peer-request check as /api/sync -- this only ever answers a
 * device already present in this device's known_peer table, i.e. pairing
 * must have already happened in both directions.
 *
 * Deliberately hands over only the admin's identity (id/name/email/role),
 * never the password/account row and never a session -- the caller mints
 * its own local session via a magic link once it has this, so there's
 * nothing else it needs, and this device's credential never crosses the
 * network.
 */
const bootstrapRequestSchema = z.object({
  deviceId: z.string().min(1),
  signature: z.string().min(1),
});

export const POST = async (request: NextRequest) => {
  const parsed = bootstrapRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const { deviceId, signature } = parsed.data;

  const [peer] = await db
    .select({ publicKey: knownPeer.publicKey })
    .from(knownPeer)
    .where(eq(knownPeer.deviceId, deviceId))
    .limit(1);

  // Same non-distinguishing rejection as /api/sync: an unknown deviceId and
  // a known deviceId with a bad signature both just come back "not paired."
  const isVerified =
    peer && (await verifySignature(peer.publicKey, { deviceId }, signature));

  if (!isVerified) {
    return NextResponse.json({ error: "Not a paired peer." }, { status: 403 });
  }

  if (!(await hasExistingUser())) {
    return NextResponse.json(
      { error: "This device has no account to hand over." },
      { status: 404 }
    );
  }

  const [admin] = await db
    .select({
      email: userTable.email,
      emailVerified: userTable.emailVerified,
      id: userTable.id,
      name: userTable.name,
      role: userTable.role,
    })
    .from(userTable)
    .limit(1);

  if (!admin) {
    return NextResponse.json(
      { error: "This device has no account to hand over." },
      { status: 404 }
    );
  }

  return NextResponse.json({ user: admin });
};
