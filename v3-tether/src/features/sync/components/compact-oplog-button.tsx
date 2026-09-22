"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { compactOplogAction } from "@/features/sync/server/actions";

/**
 * Manual trigger for server/sync/compaction.ts's history-collapsing sweep.
 * No persisted "last compaction" row to read back the way integrity checks
 * have (compaction.ts doc: this is new and unproven, so it stays a manual,
 * admin-initiated action, not something with its own tracked history yet)
 * -- the result is only ever this run's own summary, shown inline until
 * the next click or a page reload.
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
