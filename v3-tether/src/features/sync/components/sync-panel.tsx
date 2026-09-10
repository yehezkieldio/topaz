import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { PairingCodeCard } from "@/features/sync/components/pairing-code-card";
import { PairWithPeerForm } from "@/features/sync/components/pair-with-peer-form";
import { PeerList } from "@/features/sync/components/peer-list";
import { SyncNowButton } from "@/features/sync/components/sync-now-button";
import { getIsAdmin } from "@/server/auth/get-is-admin";

const CardSkeleton = () => <Skeleton className="h-40 w-full rounded-md" />;

/**
 * The whole /sync route is admin-only -- there's no public view of it, so
 * this redirects rather than conditionally rendering (06_library's pattern
 * of "show admin controls if isAdmin" doesn't apply to a page that has no
 * non-admin content at all).
 */
export const SyncPanel = async () => {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    redirect("/auth");
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<CardSkeleton />}>
        <PairingCodeCard />
      </Suspense>

      <PairWithPeerForm />

      <Suspense fallback={<CardSkeleton />}>
        <PeerList />
      </Suspense>

      <SyncNowButton />
    </div>
  );
};
