"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { compactOplogAction } from "@/features/sync/server/actions";

/**
 * Manual, on-demand trigger for server/sync/compaction.ts's
 * history-collapsing sweep -- round.ts also runs this automatically once
 * the oplog crosses its size threshold, but that run has no UI of its own
 * to report back to, so this button's result is only ever this click's own
 * summary, shown inline until the next click or a page reload. No
 * persisted "last compaction" row to read back the way integrity checks
 * have.
 */
export const CompactOplogButton = () => {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    groupsCompacted: number;
    rowsRemoved: number;
  } | null>(null);

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <Button
        className="w-full sm:w-auto"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const next = await compactOplogAction();
            setResult(next);
          });
        }}
        type="button"
        variant="outline"
      >
        {isPending ? "Compacting..." : "Compact oplog"}
      </Button>
      {result && !isPending && (
        <p className="text-muted-foreground text-xs">
          {result.groupsCompacted === 0
            ? "Nothing to compact -- every row already has a single history entry."
            : `Collapsed ${result.groupsCompacted} row${result.groupsCompacted === 1 ? "" : "s"}' history, removing ${result.rowsRemoved} old entr${result.rowsRemoved === 1 ? "y" : "ies"}.`}
        </p>
      )}
    </div>
  );
};
