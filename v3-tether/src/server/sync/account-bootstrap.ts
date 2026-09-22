import "server-only";
import { z } from "zod";

import type { db as dbClient } from "@/server/db/client";

import { getDeviceIdentity } from "./device-identity";
import { signPayload } from "./protocol";

const remoteUserSchema = z.object({
  email: z.string(),
  emailVerified: z.boolean(),
  id: z.string(),
  name: z.string(),
  role: z.enum(["user", "admin"]),
});

export type RemoteAdminUser = z.infer<typeof remoteUserSchema>;

export interface AccountBootstrapPeer {
  tailnetHostname: string;
  port: number;
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * One-shot pull of the admin identity from a just-paired peer -- the
 * counterpart to pullFromPeer (client.ts) for a device that has no account
 * yet, rather than no oplog history yet. Deliberately narrower than a real
 * sync: it never asks for or receives the peer's password/account row or
 * any session, since the caller mints its own local session via a magic
 * link right after this (bootstrapAccountFromPeerAction) and never needs
 * the source device's credential to do that.
 */
export const pullAccountFromPeer = async (
  db: typeof dbClient,
  peer: AccountBootstrapPeer
): Promise<RemoteAdminUser> => {
  const identity = await getDeviceIdentity(db);
  const requestBody = { deviceId: identity.deviceId };
  const signature = await signPayload(identity.privateKey, requestBody);

  const response = await fetch(
    `http://${peer.tailnetHostname}:${peer.port}/api/sync/bootstrap-account`,
    {
      body: JSON.stringify({ ...requestBody, signature }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Couldn't restore the account from ${peer.tailnetHostname}: HTTP ${response.status}`
    );
  }

  // SAFETY: the response body's shape is untrusted network input -- this
  // assertion only unwraps the outer `{ user }` envelope so the inner value
  // can be handed to remoteUserSchema.safeParse below, which is what
  // actually validates it before anything relies on its contents.
  const body = (await response.json()) as { user?: unknown };
  const parsed = remoteUserSchema.safeParse(body.user);
  if (!parsed.success) {
    throw new Error(
      `${peer.tailnetHostname} returned a malformed account response.`
    );
  }

  return parsed.data;
};
