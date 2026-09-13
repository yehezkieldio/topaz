"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  type SyncRoundResult,
  triggerSyncRoundAction,
} from "@/features/sync/server/actions";

/**
 * The UI's manual trigger for a sync round (08_sync/02_packaging_and_lifecycle.md).
 * Nothing runs this automatically yet -- no app-open/close lifecycle hook
 * exists -- so this button and `bun run sync round` are the only two ways
 * to actually pull from paired peers right now.
 */
export const SyncNowButton = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<SyncRoundResult[] | null>(null);

  return (
    <section className="border-border/60 bg-card/40 space-y-4 rounded-md border p-6 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Sync now</h2>
          <p className="text-muted-foreground text-sm">
            Pull changes from every paired, reachable device.
          </p>
        </div>
        <Button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const outcomes = await triggerSyncRoundAction();
              setResults(outcomes);
              router.refresh();
            });
          }}
          type="button"
        >
          {isPending ? "Syncing..." : "Sync now"}
        </Button>
      </div>

      {results && (
        <ul className="space-y-1.5 text-sm">
          {results.length === 0 && (
            <li className="text-muted-foreground">No paired peers.</li>
          )}
          {results.map((outcome) => (
            <li className="font-mono text-xs" key={outcome.deviceId}>
              {outcome.deviceId.slice(0, 8)}...{" "}
              {outcome.status === "synced" ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  synced, {outcome.rowsApplied} row(s) applied
                </span>
              ) : (
                <span className="text-destructive">
                  error -- {outcome.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
