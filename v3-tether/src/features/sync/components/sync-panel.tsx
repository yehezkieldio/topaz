import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { AutoSyncOnRestore } from "@/features/sync/components/auto-sync-on-restore";
import { MobileConnectCard } from "@/features/sync/components/mobile-connect-card";
import { PairWithPeerForm } from "@/features/sync/components/pair-with-peer-form";
import { PairingCodeCard } from "@/features/sync/components/pairing-code-card";
import { PeerList } from "@/features/sync/components/peer-list";
import { RestoreAccountForm } from "@/features/sync/components/restore-account-form";
import { SyncNowButton } from "@/features/sync/components/sync-now-button";
import { getHasAccount, getIsAdmin } from "@/server/auth/get-is-admin";

const CardSkeleton = () => <Skeleton className="h-40 w-full rounded-md" />;

/**
 * The whole /sync route is otherwise admin-only -- except a device with no
 * account at all yet, which needs to reach this same page to restore one
 * from a peer (RestoreAccountForm/bootstrapAccountFromPeerAction) before it
 * can ever have an admin session to redirect from. Everything past that
 * check keeps the original "no public view, redirect rather than
 * conditionally render" behavior.
 */
export const SyncPanel = async () => {
  const [isAdmin, hasAccount] = await Promise.all([
    getIsAdmin(),
    getHasAccount(),
  ]);

  if (!hasAccount) {
    return (
      <div className="space-y-6">
        <Suspense fallback={<CardSkeleton />}>
          <PairingCodeCard />
        </Suspense>
        <RestoreAccountForm />
      </div>
    );
  }

  if (!isAdmin) {
    redirect("/auth");
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AutoSyncOnRestore />
      </Suspense>

      <MobileConnectCard />

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
