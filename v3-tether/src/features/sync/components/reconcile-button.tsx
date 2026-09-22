"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { reconcilePeerAction } from "@/features/sync/server/actions";

const STATUS_LABEL = {
  moved: "Updated -- device moved.",
  unchanged: "Already up to date.",
  unreachable: "Still unreachable.",
  updated: "Updated.",
} as const;

/**
 * Fixes a peer's stored address after it drifts (moved hostname, changed
 * port, rotated its identity) without requiring a fresh pairing code --
 * see reconcilePeerAction's own comment for the two-step "try the stored
 * address, then rescan the tailnet" logic this triggers.
 */
export const ReconcileButton = ({ deviceId }: { deviceId: string }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const outcome = await reconcilePeerAction(deviceId);
            if (outcome.status === "success") {
              setMessage(STATUS_LABEL[outcome.data.status]);
              router.refresh();
            } else {
              setMessage("Couldn't reconcile that peer.");
            }
          });
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPending ? "Checking..." : "Reconcile"}
      </Button>
      {message && <p className="text-muted-foreground text-xs">{message}</p>}
    </div>
  );
};
