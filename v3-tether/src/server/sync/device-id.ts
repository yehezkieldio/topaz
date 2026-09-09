import "server-only";
import { eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { deviceIdentity } from "@/server/db/schema/sync";

/**
 * This device's stable identity (08_sync/00_oplog_and_clock.md), generated
 * once on first access and persisted in the single-row device_identity
 * table -- never regenerated, so oplog rows and sync pairing keep referring
 * to the same device across restarts.
 */
export const getOrCreateDeviceId = async (
  db: typeof dbClient
): Promise<string> => {
  const [existing] = await db
    .select({ deviceId: deviceIdentity.deviceId })
    .from(deviceIdentity)
    .where(eq(deviceIdentity.id, "self"))
    .limit(1);

  if (existing) {
    return existing.deviceId;
  }

  const deviceId = crypto.randomUUID();
  // onConflictDoNothing: a concurrent first-access race would otherwise
  // throw on the second insert -- the loser of that race should read back
  // the winner's row, not fail startup.
  await db.insert(deviceIdentity).values({ deviceId }).onConflictDoNothing();

  const [row] = await db
    .select({ deviceId: deviceIdentity.deviceId })
    .from(deviceIdentity)
    .where(eq(deviceIdentity.id, "self"))
    .limit(1);

  if (!row) {
    throw new Error("Failed to establish this device's identity.");
  }
  return row.deviceId;
};
