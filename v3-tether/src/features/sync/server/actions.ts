"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { toDataURL } from "qrcode";

import {
  auth,
  captureNextMagicLink,
  hasExistingUser,
  MOBILE_CONNECT_EXPIRY_SECONDS,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { requireAdmin } from "@/server/auth/require-admin";
import { requireAdminOrFreshDevice } from "@/server/auth/require-admin-or-fresh-device";
import { db } from "@/server/db/client";
import { user as userTable } from "@/server/db/schema/auth";
import { knownPeer } from "@/server/db/schema/sync";
import type { MutationResult } from "@/server/query/mutation-result";
import { pullAccountFromPeer } from "@/server/sync/account-bootstrap";
import { getDeviceIdentity } from "@/server/sync/device-identity";
import type {
  RepairOutcomeSummary,
  SyncedTableName,
} from "@/server/sync/digest";
import { getLatestIntegrityChecks } from "@/server/sync/digest";
import {
  discoverTailnetPeers,
  fetchPeerIdentity,
} from "@/server/sync/discovery";
import type { DiscoveredPeer } from "@/server/sync/discovery";
import {
  computeKeyFingerprint,
  decodePairingCode,
  encodePairingCode,
} from "@/server/sync/pairing";
import type { PairingPayload } from "@/server/sync/pairing";
import { signPayload } from "@/server/sync/protocol";
import { repairMismatchedTablesWithPeer } from "@/server/sync/repair";
import {
  checkIntegrityWithAllKnownPeers,
  syncWithAllKnownPeers,
} from "@/server/sync/round";

const PAIR_REQUEST_FETCH_TIMEOUT_MS = 10_000;

const MOBILE_CONNECT_CALLBACK_PATH = "/library";
const ACCOUNT_RESTORE_CALLBACK_PATH = "/sync?justRestored=1";

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
 *
 * Guarded by requireAdminOrFreshDevice, not requireAdmin: a brand-new
 * device with no account yet still needs to hand its own code to an
 * existing device before bootstrapAccountFromPeerAction can trust it back
 * (see require-admin-or-fresh-device.ts).
 */
export const generatePairingCodeAction = async (): Promise<PairingCode> => {
  await requireAdminOrFreshDevice();

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

    const tailnetOrigin = `http://${env.SYNC_TAILNET_HOSTNAME}:${env.SYNC_PORT}`;
    const callbackURL = `${tailnetOrigin}${MOBILE_CONNECT_CALLBACK_PATH}`;

    const capture = captureNextMagicLink();
    await auth.api.signInMagicLink({
      body: { callbackURL, email: admin.email },
      headers: await headers(),
    });
    const { token } = await capture;

    const url = new URL(`${tailnetOrigin}/api/auth/magic-link/verify`);
    url.searchParams.set("token", token);
    url.searchParams.set("callbackURL", callbackURL);

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
 *
 * Guarded by requireAdminOrFreshDevice, not requireAdmin -- see
 * generatePairingCodeAction and bootstrapAccountFromPeerAction, which calls
 * this directly as the first half of restoring an account on a fresh
 * device.
 */
export const pairWithPeerAction = async (
  code: string
): Promise<MutationResult<PairedPeer>> => {
  await requireAdminOrFreshDevice();

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

export interface AccountRestoreResult {
  verifyUrl: string;
}

/**
 * Restores this device's account from an already-set-up peer, in one paste
 * (docs/GETTING_STARTED_SYNC.md, "Restoring an account on a new device") --
 * the same pairing code doing double duty: pairWithPeerAction establishes
 * peer trust, then pullAccountFromPeer (account-bootstrap.ts) uses that
 * trust to pull just the admin's identity (never a password or session) so
 * this device can mint its own local session for it via a magic link. Only
 * ever runs when this device has no account yet -- once it does, pairing
 * additional peers goes through the plain pairWithPeerAction path above,
 * with no bootstrap attempt.
 */
export const bootstrapAccountFromPeerAction = async (
  code: string
): Promise<MutationResult<AccountRestoreResult>> => {
  if (await hasExistingUser()) {
    return {
      fieldErrors: {
        code: ["This device already has an account -- nothing to restore."],
      },
      status: "validation-error",
    };
  }

  const pairResult = await pairWithPeerAction(code);
  if (pairResult.status !== "success") {
    return pairResult;
  }
  const peer = pairResult.data;

  let remoteUser: Awaited<ReturnType<typeof pullAccountFromPeer>>;
  try {
    remoteUser = await pullAccountFromPeer(db, {
      port: peer.port,
      tailnetHostname: peer.tailnetHostname,
    });
  } catch (error) {
    return {
      fieldErrors: {
        code: [
          error instanceof Error
            ? error.message
            : "Couldn't reach that device to restore the account.",
        ],
      },
      status: "validation-error",
    };
  }

  await db.insert(userTable).values({
    email: remoteUser.email,
    emailVerified: remoteUser.emailVerified,
    id: remoteUser.id,
    name: remoteUser.name,
    role: remoteUser.role,
  });

  const capture = captureNextMagicLink();
  await auth.api.signInMagicLink({
    body: {
      callbackURL: ACCOUNT_RESTORE_CALLBACK_PATH,
      email: remoteUser.email,
    },
    headers: await headers(),
  });
  const { token } = await capture;

  const verifyUrl = `/api/auth/magic-link/verify?token=${encodeURIComponent(
    token
  )}&callbackURL=${encodeURIComponent(ACCOUNT_RESTORE_CALLBACK_PATH)}`;

  return { data: { verifyUrl }, status: "success" };
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

/**
 * Every online tailnet peer, probed for a running Topaz instance -- backs
 * the pairing screen's discovered-devices list (an alternative to typing or
 * scanning a code, kept alongside it rather than replacing it: a peer on a
 * different port, or off the tailnet's `tailscale` CLI path, still needs
 * the manual flow). Guarded like generatePairingCodeAction/pairWithPeerAction
 * -- a brand-new device with no account yet still needs to discover and
 * pair before it can restore an account from a peer.
 */
export const discoverTailnetPeersAction = async (): Promise<
  DiscoveredPeer[]
> => {
  await requireAdminOrFreshDevice();
  return await discoverTailnetPeers();
};

export interface PeerIdentityPreview {
  payload: PairingPayload;
  fingerprint: string;
}

/**
 * Re-fetches a discovered device's identity right before pairing with it,
 * rather than trusting the snapshot from discoverTailnetPeersAction --
 * closes the gap between "this device was listed a moment ago" and "this
 * is what I'm actually about to trust," and gives the fingerprint shown in
 * the confirmation step (the one human checkpoint in this flow) the
 * freshest possible value.
 */
export const fetchPeerIdentityAction = async (
  hostname: string,
  port: number
): Promise<MutationResult<PeerIdentityPreview>> => {
  await requireAdminOrFreshDevice();

  try {
    const payload = await fetchPeerIdentity(hostname, port);
    const fingerprint = await computeKeyFingerprint(payload.publicKeyRaw);
    return { data: { fingerprint, payload }, status: "success" };
  } catch (error) {
    return {
      fieldErrors: {
        hostname: [
          error instanceof Error
            ? error.message
            : "Couldn't reach that device.",
        ],
      },
      status: "validation-error",
    };
  }
};

export interface DiscoveredPairResult extends PairedPeer {
  reciprocalConfirmed: boolean;
}

/**
 * One-click pairing once the admin has confirmed a discovered device's
 * fingerprint: stores trust locally exactly like the manual-code path
 * (pairWithPeerAction, reused as-is via encodePairingCode), then pushes
 * this device's own signed identity to the peer's /api/sync/pair-request
 * so it trusts back automatically -- no second confirmation on that side
 * (see that route's own comment for why). The reciprocal push is
 * best-effort: local pairing already succeeded by the time it runs, so a
 * failed push is reported, not treated as a hard failure -- the admin can
 * always pair from the other device too if sync doesn't work afterward.
 */
export const confirmDiscoveredPairAction = async (
  payload: PairingPayload
): Promise<MutationResult<DiscoveredPairResult>> => {
  const pairResult = await pairWithPeerAction(encodePairingCode(payload));
  if (pairResult.status !== "success") {
    return pairResult;
  }

  const identity = await getDeviceIdentity(db);
  const reciprocalPayload = {
    deviceId: identity.deviceId,
    port: env.SYNC_PORT,
    publicKeyRaw: identity.publicKeyRaw,
    tailnetHostname: env.SYNC_TAILNET_HOSTNAME,
    timestamp: Date.now(),
  };
  const signature = await signPayload(identity.privateKey, reciprocalPayload);

  let reciprocalConfirmed = false;
  try {
    const response = await fetch(
      `http://${payload.tailnetHostname}:${payload.port}/api/sync/pair-request`,
      {
        body: JSON.stringify({ ...reciprocalPayload, signature }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: AbortSignal.timeout(PAIR_REQUEST_FETCH_TIMEOUT_MS),
      }
    );
    reciprocalConfirmed = response.ok;
  } catch {
    reciprocalConfirmed = false;
  }

  return {
    data: { ...pairResult.data, reciprocalConfirmed },
    status: "success",
  };
};

export interface ReconcileResult {
  status: "updated" | "unchanged" | "moved" | "unreachable";
  peer?: PairedPeer;
}

const toPairedPeer = async (row: {
  createdAt: Date;
  deviceId: string;
  port: number;
  publicKey: string;
  tailnetHostname: string;
}): Promise<PairedPeer> => ({
  deviceId: row.deviceId,
  fingerprint: await computeKeyFingerprint(row.publicKey),
  pairedAt: row.createdAt,
  port: row.port,
  tailnetHostname: row.tailnetHostname,
});

/**
 * Fixes a paired peer's stored address after it drifts (moved to a new
 * tailnet hostname, changed port, rotated its identity) -- first tries the
 * address already on file, since that's the common case and needs no
 * rescan; only falls back to a fresh discovery pass, matching by deviceId,
 * when the stored address no longer answers or now answers for a
 * different device. "Rotating where a device lives on the tailnet
 * shouldn't force a full resync" (pairWithPeerAction's own comment) --
 * this just automates that update instead of requiring a fresh pairing
 * code paste.
 */
export const reconcilePeerAction = async (
  deviceId: string
): Promise<MutationResult<ReconcileResult>> => {
  await requireAdmin();

  const [stored] = await db
    .select()
    .from(knownPeer)
    .where(eq(knownPeer.deviceId, deviceId))
    .limit(1);

  if (!stored) {
    return { status: "not-found" };
  }

  const applyUpdate = async (identity: PairingPayload): Promise<PairedPeer> => {
    const [row] = await db
      .update(knownPeer)
      .set({
        port: identity.port,
        publicKey: identity.publicKeyRaw,
        tailnetHostname: identity.tailnetHostname,
      })
      .where(eq(knownPeer.deviceId, deviceId))
      .returning();
    if (!row) {
      throw new Error("Failed to update peer.");
    }
    return await toPairedPeer(row);
  };

  try {
    const identity = await fetchPeerIdentity(
      stored.tailnetHostname,
      stored.port
    );
    if (identity.deviceId !== deviceId) {
      throw new Error("Address now answers for a different device.");
    }

    const unchanged =
      identity.port === stored.port &&
      identity.publicKeyRaw === stored.publicKey &&
      identity.tailnetHostname === stored.tailnetHostname;

    if (unchanged) {
      return {
        data: { peer: await toPairedPeer(stored), status: "unchanged" },
        status: "success",
      };
    }

    return {
      data: { peer: await applyUpdate(identity), status: "updated" },
      status: "success",
    };
  } catch {
    // Stored address is stale -- fall through to rediscovery below.
  }

  const discovered = await discoverTailnetPeers();
  const match = discovered.find((peer) => peer.identity?.deviceId === deviceId);

  if (match?.identity) {
    return {
      data: { peer: await applyUpdate(match.identity), status: "moved" },
      status: "success",
    };
  }

  return { data: { status: "unreachable" }, status: "success" };
};

export interface IntegrityStatus {
  deviceId: string;
  mismatchedTables: SyncedTableName[];
  checkedAt: Date;
  lastRepairAt: Date | null;
  lastRepairResult: RepairOutcomeSummary[] | null;
}

/**
 * The sync UI's read path for the last recorded digest comparison against
 * each peer (08_sync/03_data_integrity_and_reconciliation.md's Part 1 --
 * "which table, which peer, when last checked"). A peer with no row yet has
 * simply never had a check run against it -- there's no periodic job on a
 * fresh install until INTEGRITY_CHECK_EVERY_N_ROUNDS worth of sync rounds
 * have happened, or the admin presses "Check integrity" themselves.
 */
export const getIntegrityStatusAction = async (): Promise<
  IntegrityStatus[]
> => {
  await requireAdmin();
  return await getLatestIntegrityChecks(db);
};

/**
 * The UI's manual "Check integrity" action -- runs a digest comparison
 * against every paired peer right now, instead of waiting for the periodic
 * trigger folded into syncWithAllKnownPeers (round.ts). Returns the
 * refreshed statuses directly so the button doesn't need a second
 * round-trip just to show its own result.
 */
export const checkIntegrityNowAction = async (): Promise<IntegrityStatus[]> => {
  await requireAdmin();
  await checkIntegrityWithAllKnownPeers(db);
  return await getLatestIntegrityChecks(db);
};

export interface RepairSummary {
  deviceId: string;
  repairedAt: Date;
  outcomes: RepairOutcomeSummary[];
}

/**
 * Phase 2's manual "Repair now" trigger (08_sync/03_data_integrity_and_reconciliation.md:
 * "A 'Repair now' action next to a flagged mismatch runs the full-table
 * pull and reconciliation... on demand, with a visible result"). Repairs
 * only whatever the most recent integrity check against this peer actually
 * flagged -- if nothing is currently flagged (stale click, or a check
 * already cleared it), this is a validation error rather than a full
 * unconditional resync of all five tables.
 *
 * Deliberately manual, not triggered automatically from round.ts on a
 * detected mismatch -- that's Phase 3, which the spec is explicit hasn't
 * been earned yet ("only after Phase 2 has proven reliable in practice").
 */
export const repairPeerMismatchAction = async (
  deviceId: string
): Promise<MutationResult<RepairSummary>> => {
  await requireAdmin();

  const [peer] = await db
    .select({
      deviceId: knownPeer.deviceId,
      port: knownPeer.port,
      tailnetHostname: knownPeer.tailnetHostname,
    })
    .from(knownPeer)
    .where(eq(knownPeer.deviceId, deviceId))
    .limit(1);

  if (!peer) {
    return { status: "not-found" };
  }

  const checks = await getLatestIntegrityChecks(db);
  const latestCheck = checks.find((check) => check.deviceId === deviceId);

  if (!latestCheck || latestCheck.mismatchedTables.length === 0) {
    return {
      fieldErrors: {
        deviceId: ["No known mismatch to repair -- run a check first."],
      },
      status: "validation-error",
    };
  }

  try {
    const result = await repairMismatchedTablesWithPeer(
      db,
      peer,
      latestCheck.mismatchedTables
    );
    return { data: result, status: "success" };
  } catch (error) {
    return {
      fieldErrors: {
        deviceId: [
          error instanceof Error
            ? error.message
            : "Couldn't reach that device to repair it.",
        ],
      },
      status: "validation-error",
    };
  }
};
