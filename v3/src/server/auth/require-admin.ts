import "server-only";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Thrown by requireAdmin() for both "no session" and "non-admin session" --
 * callers (e.g. scripts/verify-auth-roles.ts) check for this class rather
 * than matching on `error.message`, so the check stays valid even if the
 * message text changes.
 */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden: admin role required") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const requireAdmin = async () => {
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

  return session;
};
