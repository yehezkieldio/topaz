"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { repairPeerMismatchAction } from "@/features/sync/server/actions";

/**
 * Phase 2's manual repair trigger (08_sync/03_data_integrity_and_reconciliation.md:
 * "A 'Repair now' action next to a flagged mismatch"). Only rendered next
 * to a peer IntegrityStatus already shows as mismatched -- see
 * integrity-status.tsx. Shows the error inline rather than silently
 * swallowing it (unlike CheckIntegrityButton) since a repair failure is a
 * more consequential outcome the admin should actually see.
 */
export const RepairPeerButton = ({ deviceId }: { deviceId: string }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await repairPeerMismatchAction(deviceId);
            if (result.status === "validation-error") {
              setError(result.fieldErrors.deviceId?.[0] ?? "Repair failed.");
              return;
            }
            setError(null);
            router.refresh();
          });
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPending ? "Repairing..." : "Repair now"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
};
