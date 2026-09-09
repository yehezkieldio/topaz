import "server-only";
import { eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { deviceIdentity } from "@/server/db/schema/sync";

const ED25519 = { name: "Ed25519" } as const;

/**
 * This device's stable identity plus its Ed25519 keypair
 * (08_sync/00_oplog_and_clock.md, 01_transport_and_pairing.md) --
 * established once on first run and cached for the process's lifetime.
 * `privateKey` never leaves this module; only `publicKeyRaw` is ever
 * handed to pairing/transport code.
 */
export interface DeviceIdentity {
  deviceId: string;
  privateKey: CryptoKey;
  publicKeyRaw: string;
}

const toBase64 = (buffer: ArrayBuffer): string =>
  Buffer.from(buffer).toString("base64");

const fromBase64 = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, "base64"));

interface GeneratedKeypair {
  privateKey: CryptoKey;
  privateKeyPkcs8: string;
  publicKeyRaw: string;
}

const generateKeypair = async (): Promise<GeneratedKeypair> => {
  const keyPair = (await crypto.subtle.generateKey(ED25519, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const [privateKeyPkcs8Buffer, publicKeyRawBuffer] = await Promise.all([
    crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
    crypto.subtle.exportKey("raw", keyPair.publicKey),
  ]);

  return {
    privateKey: keyPair.privateKey,
    privateKeyPkcs8: toBase64(privateKeyPkcs8Buffer),
    publicKeyRaw: toBase64(publicKeyRawBuffer),
  };
};

const selectSelf = (db: typeof dbClient) =>
  db
    .select({
      deviceId: deviceIdentity.deviceId,
      privateKeyPkcs8: deviceIdentity.privateKeyPkcs8,
      publicKeyRaw: deviceIdentity.publicKeyRaw,
    })
    .from(deviceIdentity)
    .where(eq(deviceIdentity.id, "self"))
    .limit(1);

const establishDeviceIdentity = async (
  db: typeof dbClient
): Promise<DeviceIdentity> => {
  const [existing] = await selectSelf(db);

  if (!existing) {
    const generated = await generateKeypair();
    // onConflictDoNothing: a concurrent first-access race would otherwise
    // throw on the second insert -- the loser of that race reads back the
    // winner's row below instead of failing startup.
    await db
      .insert(deviceIdentity)
      .values({
        deviceId: crypto.randomUUID(),
        privateKeyPkcs8: generated.privateKeyPkcs8,
        publicKeyRaw: generated.publicKeyRaw,
      })
      .onConflictDoNothing();
  }

  const [row] = existing ? [existing] : await selectSelf(db);
  if (!row) {
    throw new Error("Failed to establish this device's identity.");
  }

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(row.privateKeyPkcs8),
    ED25519,
    false,
    ["sign"]
  );

  return { deviceId: row.deviceId, privateKey, publicKeyRaw: row.publicKeyRaw };
};

let identityPromise: Promise<DeviceIdentity> | null = null;

export const getDeviceIdentity = (
  db: typeof dbClient
): Promise<DeviceIdentity> => {
  identityPromise ??= establishDeviceIdentity(db);
  return identityPromise;
};
