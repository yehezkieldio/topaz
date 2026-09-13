import "server-only";
import { headers } from "next/headers";

import { auth, hasExistingUser } from "@/lib/auth";

/**
 * Whether this device's one account has been created yet -- decides
 * whether the auth UI shows a sign-up form or a sign-in form
 * (02_stack/04_auth_and_authorization.md: sign-up is a one-time,
 * single-account gate, not an ongoing choice).
 */
export const getHasAccount = () => hasExistingUser();

export const getIsAdmin = async () => {
  // SAFETY: auth.api.getSession()'s generic return type doesn't carry this
  // instance's configured plugins (e.g. the admin-role field), but the value
  // it returns at runtime always comes from this same `auth` instance, so
  // it structurally matches `auth.$Infer.Session`.
  const session = (await auth.api.getSession({
    headers: await headers(),
  })) as typeof auth.$Infer.Session | null;

  return session?.user.role === "admin";
};
