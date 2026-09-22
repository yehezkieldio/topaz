import "server-only";
import { headers } from "next/headers";

import { auth, hasExistingUser } from "@/lib/auth";
import { ForbiddenError } from "@/server/auth/require-admin";

/**
 * Generating or accepting a pairing code carries no admin capability by
 * itself -- it's a public key plus a Tailscale address, safe to show before
 * any account exists on this device (see pair-with-peer-form.tsx's existing
 * note that a pairing code is "safe to leave on screen indefinitely"). A
 * brand-new device has to be able to run both halves of pairing before it
 * has an admin session to restore its account from a peer
 * (account-bootstrap.ts) -- once an account exists here, this reverts to the
 * normal admin-only gate.
 */
export const requireAdminOrFreshDevice = async (): Promise<void> => {
  if (!(await hasExistingUser())) {
    return;
  }

  // SAFETY: auth.api.getSession()'s generic return type doesn't carry this
  // instance's configured plugins (e.g. the admin-role field), but the value
  // it returns at runtime always comes from this same `auth` instance, so
  // it structurally matches `auth.$Infer.Session`.
  const session = (await auth.api.getSession({
    headers: await headers(),
  })) as typeof auth.$Infer.Session | null;

  if (!session || session.user.role !== "admin") {
    throw new ForbiddenError();
  }
};
