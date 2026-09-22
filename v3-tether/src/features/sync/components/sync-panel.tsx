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
    <div className="space-y-10">
      <Suspense fallback={null}>
        <AutoSyncOnRestore />
      </Suspense>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-medium tracking-tight">
            Share this device
          </h2>
          <p className="text-muted-foreground text-sm">
            Let another laptop pair as a full peer, or let a phone sign in
            without keeping its own copy of the library.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Suspense fallback={<CardSkeleton />}>
            <PairingCodeCard />
          </Suspense>
          <MobileConnectCard />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-medium tracking-tight">Devices</h2>
          <p className="text-muted-foreground text-sm">
            Pair with a device using its code, then pull whatever changed on it.
          </p>
        </div>

        <PairWithPeerForm />

        <div className="border-border/60 bg-card/40 space-y-4 rounded-md border p-6 backdrop-blur-md">
          <h3 className="text-sm font-medium">Paired devices</h3>
          <Suspense fallback={<Skeleton className="h-16 w-full" />}>
            <PeerList />
          </Suspense>
          <div className="border-border/50 border-t pt-4">
            <SyncNowButton />
          </div>
        </div>
      </section>
    </div>
  );
};
