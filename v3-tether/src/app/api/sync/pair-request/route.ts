import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/server/db/client";
import { knownPeer } from "@/server/db/schema/sync";
import { getDeviceIdentity } from "@/server/sync/device-identity";
import { verifySignature } from "@/server/sync/protocol";

const PAIR_REQUEST_MAX_SKEW_MS = 60_000;

const pairRequestSchema = z.object({
  deviceId: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  publicKeyRaw: z.string().min(1),
  signature: z.string().min(1),
  tailnetHostname: z.string().min(1),
  timestamp: z.number(),
});

/**
 * The reciprocal half of one-click discovered pairing
 * (confirmDiscoveredPairAction, src/features/sync/server/actions.ts): once
 * an admin confirms a fingerprint on the *initiating* device, that device
 * pushes its own identity here so both directions of trust complete in one
 * click, instead of requiring the admin to repeat the same confirmation on
 * this device too.
 *
 * This deliberately auto-trusts any well-formed, freshly-signed request --
 * there is no second human confirmation on this side. That is a considered
 * choice, not an oversight: this device's tailnet is already the declared
 * trust boundary (only the admin's own devices are ever on it), and the
 * one human checkpoint that actually matters -- "is this really the
 * device I meant to pair with" -- already happened when the admin compared
 * the fingerprint shown on the initiating device before it ever called
 * this endpoint. The signature here only proves the caller holds the
 * private key matching the public key it is offering (trust-on-first-use),
 * not that the caller is who it claims -- the fingerprint check upstream
 * is what actually establishes that.
 */
export const POST = async (request: NextRequest) => {
  const parsed = pairRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Malformed pair request." },
      { status: 400 }
    );
  }
  const {
    deviceId,
    port,
    publicKeyRaw,
    signature,
    tailnetHostname,
    timestamp,
  } = parsed.data;

  if (Math.abs(Date.now() - timestamp) > PAIR_REQUEST_MAX_SKEW_MS) {
    return NextResponse.json({ error: "Request expired." }, { status: 400 });
  }

  const identity = await getDeviceIdentity(db);
  if (deviceId === identity.deviceId) {
    return NextResponse.json(
      { error: "Can't pair with self." },
      { status: 400 }
    );
  }

  const isVerified = await verifySignature(
    publicKeyRaw,
    { deviceId, port, publicKeyRaw, tailnetHostname, timestamp },
    signature
  );
  if (!isVerified) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  await db
    .insert(knownPeer)
    .values({ deviceId, port, publicKey: publicKeyRaw, tailnetHostname })
    .onConflictDoUpdate({
      set: { port, publicKey: publicKeyRaw, tailnetHostname },
      target: knownPeer.deviceId,
    });

  return NextResponse.json({ ok: true });
};
