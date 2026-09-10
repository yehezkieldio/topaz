import { RadioTower } from "lucide-react";
import Link from "next/link";

import { getIsAdmin } from "@/server/auth/get-is-admin";

/**
 * The only place /sync (device pairing/sync) is linked from today -- there's
 * no shared nav in (main)/ to hang it off of otherwise. Admin-only, since
 * the whole /sync route redirects non-admins away anyway.
 */
export const SyncLink = async () => {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return null;
  }

  return (
    <Link
      aria-label="Device sync"
      className="border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:bg-background/60 inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition"
      href="/sync"
      prefetch={false}
      title="Device sync"
    >
      <RadioTower className="size-4" />
    </Link>
  );
};
