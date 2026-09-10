"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { toDataURL } from "qrcode";

import {
  auth,
  captureNextMagicLink,
  MOBILE_CONNECT_EXPIRY_SECONDS,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db/client";
import { user as userTable } from "@/server/db/schema/auth";
import { knownPeer } from "@/server/db/schema/sync";
import type { MutationResult } from "@/server/query/mutation-result";
import { getDeviceIdentity } from "@/server/sync/device-identity";
import {
  computeKeyFingerprint,
  decodePairingCode,
  encodePairingCode,
} from "@/server/sync/pairing";
import { syncWithAllKnownPeers } from "@/server/sync/round";

const MOBILE_CONNECT_CALLBACK_PATH = "/library";

export interface PairingCode {
  code: string;
  fingerprint: string;
  deviceId: string;
}

/**
 * This device's own pairing code -- displayed as text (or wrapped in a QR
 * by whatever renders it) so the admin can enter or scan it on the other
 * device (08_sync/01_transport_and_pairing.md). Generating it never
 * touches known_peer; nothing is trusted until the *other* device's code
 * is captured here via pairWithPeerAction.
 */
export const generatePairingCodeAction = async (): Promise<PairingCode> => {
  await requireAdmin();

  const identity = await getDeviceIdentity(db);
  const code = encodePairingCode({
    deviceId: identity.deviceId,
    port: env.SYNC_PORT,
    publicKeyRaw: identity.publicKeyRaw,
    tailnetHostname: env.SYNC_TAILNET_HOSTNAME,
  });
  const fingerprint = await computeKeyFingerprint(identity.publicKeyRaw);

  return { code, deviceId: identity.deviceId, fingerprint };
};

/**
 * The same pairing code as generatePairingCodeAction, rendered server-side
 * as a QR code (a PNG data URL) -- so scanning it on the other device is an
 * option alongside copy-pasting the raw code, with no client-side QR
 * library needed at all.
 */
export const generatePairingQrCodeAction = async (): Promise<string> => {
  const { code } = await generatePairingCodeAction();
  return await toDataURL(code, { margin: 1, width: 320 });
};

export interface MobileConnectLink {
  url: string;
  qrDataUrl: string;
  expiresInSeconds: number;
}

/**
 * "Connect a phone" (thin-client mobile mode, see docs/GETTING_STARTED_SYNC.md):
 * the phone has no local database and never joins the oplog/pairing mesh --
 * it's just a browser pointed at this device's server. The ergonomic part
 * is not typing a Tailscale URL and a password on a phone keyboard: this
 * mints a one-time magic-link sign-in for the device's single admin
 * account and QR-encodes it, addressed at this device's own tailnet
 * hostname/port (the same address embedded in pairing codes) rather than
 * whatever BETTER_AUTH_URL happens to be configured as, since that's
 * typically a localhost value meaningless to another device. Scanning it
 * opens the browser straight into an authenticated /library -- the link is
 * single-use and expires in MOBILE_CONNECT_EXPIRY_SECONDS, so a stale
 * screenshot of an old QR code stops working on its own.
 */
export const generateMobileConnectAction =
  async (): Promise<MobileConnectLink> => {
    await requireAdmin();

    const [admin] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .limit(1);
    if (!admin) {
      throw new Error("No admin account exists yet.");
    }

    const capture = captureNextMagicLink();
    await auth.api.signInMagicLink({
      body: { callbackURL: MOBILE_CONNECT_CALLBACK_PATH, email: admin.email },
      headers: await headers(),
    });
    const { token } = await capture;

    const url = new URL(
      `http://${env.SYNC_TAILNET_HOSTNAME}:${env.SYNC_PORT}/api/auth/magic-link/verify`
    );
    url.searchParams.set("token", token);
    url.searchParams.set("callbackURL", MOBILE_CONNECT_CALLBACK_PATH);

    const qrDataUrl = await toDataURL(url.toString(), {
      margin: 1,
      width: 320,
    });

    return {
      expiresInSeconds: MOBILE_CONNECT_EXPIRY_SECONDS,
      qrDataUrl,
      url: url.toString(),
    };
  };

export interface PairedPeer {
  deviceId: string;
  tailnetHostname: string;
  port: number;
  fingerprint: string;
  pairedAt: Date;
}

/**
 * Records trust in a peer whose pairing code was captured out-of-band (a QR
 * scan or a typed code) -- a purely local write, no network round trip to
 * that peer, matching the "deliberate, manual, admin-initiated" pairing
 * model (08_sync/01_transport_and_pairing.md: there is no automatic
 * "trust any new device on the tailnet" path). Re-pairing an
 * already-known device updates its stored hostname/port/key without
 * resetting its sync checkpoint -- rotating where a device lives on the
 * tailnet shouldn't force a full resync against it.
 */
export const pairWithPeerAction = async (
  code: string
): Promise<MutationResult<PairedPeer>> => {
  await requireAdmin();

  const payload = decodePairingCode(code.trim());
  if (!payload) {
    return {
      fieldErrors: { code: ["That pairing code isn't valid."] },
      status: "validation-error",
    };
  }

  const identity = await getDeviceIdentity(db);
  if (payload.deviceId === identity.deviceId) {
    return {
      fieldErrors: { code: ["That's this device's own pairing code."] },
      status: "validation-error",
    };
  }

  const [row] = await db
    .insert(knownPeer)
    .values({
      deviceId: payload.deviceId,
      port: payload.port,
      publicKey: payload.publicKeyRaw,
      tailnetHostname: payload.tailnetHostname,
    })
    .onConflictDoUpdate({
      set: {
        port: payload.port,
        publicKey: payload.publicKeyRaw,
        tailnetHostname: payload.tailnetHostname,
      },
      target: knownPeer.deviceId,
    })
    .returning({
      createdAt: knownPeer.createdAt,
      deviceId: knownPeer.deviceId,
      port: knownPeer.port,
      tailnetHostname: knownPeer.tailnetHostname,
    });

  if (!row) {
    throw new Error("Failed to record paired peer.");
  }

  const fingerprint = await computeKeyFingerprint(payload.publicKeyRaw);

  return {
    data: {
      deviceId: row.deviceId,
      fingerprint,
      pairedAt: row.createdAt,
      port: row.port,
      tailnetHostname: row.tailnetHostname,
    },
    status: "success",
  };
};

/**
 * Every device this one currently trusts -- a settings/pairing screen's
 * read path. Recomputes each fingerprint from the stored public key rather
 * than caching it, so it can never drift from what's actually stored.
 */
export const listPairedPeersAction = async (): Promise<PairedPeer[]> => {
  await requireAdmin();

  const rows = await db
    .select({
      createdAt: knownPeer.createdAt,
      deviceId: knownPeer.deviceId,
      port: knownPeer.port,
      publicKey: knownPeer.publicKey,
      tailnetHostname: knownPeer.tailnetHostname,
    })
    .from(knownPeer);

  return await Promise.all(
    rows.map(async (row) => ({
      deviceId: row.deviceId,
      fingerprint: await computeKeyFingerprint(row.publicKey),
      pairedAt: row.createdAt,
      port: row.port,
      tailnetHostname: row.tailnetHostname,
    }))
  );
};

/**
 * Removes a paired peer (08_sync/01_transport_and_pairing.md: "losing a
 * device... means removing its known_peer row on the remaining devices").
 * No separate revocation protocol beyond this -- the remaining devices
 * simply stop trusting that key, which is sufficient for a fixed,
 * admin-controlled set of trusted devices.
 */
export const unpairPeerAction = async (
  deviceId: string
): Promise<MutationResult<{ deviceId: string }>> => {
  await requireAdmin();

  const [deleted] = await db
    .delete(knownPeer)
    .where(eq(knownPeer.deviceId, deviceId))
    .returning({ deviceId: knownPeer.deviceId });

  if (!deleted) {
    return { status: "not-found" };
  }

  return { data: { deviceId: deleted.deviceId }, status: "success" };
};

export interface SyncRoundResult {
  deviceId: string;
  status: "synced" | "error";
  rowsApplied: number;
  error?: string;
}

/**
 * One manual sync attempt against every paired peer
 * (08_sync/02_packaging_and_lifecycle.md) -- the UI's "Sync now" action.
 * Nothing calls syncWithAllKnownPeers automatically yet (no app-open/close
 * lifecycle hook exists), so this is currently the only way to trigger a
 * round from inside the app itself, alongside `bun run sync round`.
 */
export const triggerSyncRoundAction = async (): Promise<SyncRoundResult[]> => {
  await requireAdmin();
  return await syncWithAllKnownPeers(db);
};
