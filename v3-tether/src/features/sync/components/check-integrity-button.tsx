"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { checkIntegrityNowAction } from "@/features/sync/server/actions";

/**
 * The manual half of Part 1's trigger ("every Nth round, on a manual
 * 'Check integrity' button, or both" -- 08_sync/03_data_integrity_and_reconciliation.md).
 * Runs immediately against every paired peer rather than waiting for the
 * periodic check folded into a normal sync round.
 */
export const CheckIntegrityButton = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="w-full sm:w-auto"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await checkIntegrityNowAction();
          router.refresh();
        });
      }}
      type="button"
      variant="outline"
    >
      {isPending ? "Checking..." : "Check integrity"}
    </Button>
  );
};
