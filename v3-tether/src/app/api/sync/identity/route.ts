import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { getDeviceIdentity } from "@/server/sync/device-identity";

/**
 * This device's own pairing payload, read-only and unauthenticated --
 * exactly what a pairing code/QR already broadcasts on /sync
 * (src/server/sync/pairing.ts's PairingPayload), so exposing it over the
 * tailnet adds no new secret. Lets a peer's discovery scan
 * (src/server/sync/discovery.ts) find this device without the admin typing
 * or scanning anything first.
 */
export const GET = async () => {
  const identity = await getDeviceIdentity(db);
  return NextResponse.json({
    deviceId: identity.deviceId,
    port: env.SYNC_PORT,
    publicKeyRaw: identity.publicKeyRaw,
    tailnetHostname: env.SYNC_TAILNET_HOSTNAME,
  });
};
