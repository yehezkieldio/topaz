import Link from "next/link";
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { SyncPanel } from "@/features/sync/components/sync-panel";

export const metadata = {
  description: "Pair this device with your other devices and sync.",
  title: "Device Sync | Topaz",
};

const SyncPage = () => (
  <div className="bg-background min-h-dvh">
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-1">
        <Link
          className="text-muted-foreground hover:text-foreground text-xs"
          href="/library"
          prefetch={false}
        >
          &larr; Back to library
        </Link>
        <h1 className="text-xl font-medium tracking-tight">Device sync</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Pair this device with your other devices over Tailscale, then pull
          each other's changes. See{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            docs/GETTING_STARTED_SYNC.md
          </code>{" "}
          for the full walkthrough.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-40 w-full rounded-md" />}>
        <SyncPanel />
      </Suspense>
    </div>
  </div>
);

export default SyncPage;
