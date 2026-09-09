import "server-only";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

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
