import "server-only";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export const requireAdmin = async () => {
  const session = (await auth.api.getSession({
    headers: await headers(),
  })) as typeof auth.$Infer.Session | null;

  if (!session || session.user.role !== "admin") {
    throw new Error("Forbidden: admin role required");
  }

  return session;
};
