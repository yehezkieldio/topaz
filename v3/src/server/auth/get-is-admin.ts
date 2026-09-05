import "server-only";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export const getIsAdmin = async () => {
  const session = (await auth.api.getSession({
    headers: await headers(),
  })) as typeof auth.$Infer.Session | null;

  return session?.user.role === "admin";
};
