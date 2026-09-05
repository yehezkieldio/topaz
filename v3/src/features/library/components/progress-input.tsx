"use client";

import { startTransition, useActionState, useId, useOptimistic } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MutationResult } from "@/server/query/mutation-result";

interface ProgressState {
  currentChapter: number | null;
  version: number;
}

export const ProgressInput = ({
  currentChapter,
  libraryEntryPublicId,
  updateProgressAction,
  version,
}: {
  libraryEntryPublicId: string;
  currentChapter: number | null;
  version: number;
  updateProgressAction: (
    libraryEntryPublicId: string,
    expectedVersion: number,
    currentChapter: number | null
  ) => Promise<MutationResult<ProgressState>>;
}) => {
  const inputId = useId();

  const [state, dispatch, isPending] = useActionState<
    MutationResult<ProgressState> | null,
    number | null
  >(async (previous, nextChapter) => {
    const currentVersion =
      previous?.status === "success" ? previous.data.version : version;
    return await updateProgressAction(
      libraryEntryPublicId,
      currentVersion,
      nextChapter
    );
  }, null);

  const committedChapter =
    state?.status === "success" ? state.data.currentChapter : currentChapter;
  const [optimisticChapter, setOptimisticChapter] =
    useOptimistic(committedChapter);

  const handleCommit = (raw: string) => {
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const nextChapter =
      parsed === null || Number.isNaN(parsed) ? null : Math.max(0, parsed);

    if (nextChapter === optimisticChapter) {
      return;
    }

    startTransition(() => {
      setOptimisticChapter(nextChapter);
      dispatch(nextChapter);
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-muted-foreground text-xs" htmlFor={inputId}>
        Ch.
      </Label>
      <Input
        aria-label="Current chapter"
        className="h-6 w-14 rounded-sm px-1.5 text-xs"
        defaultValue={optimisticChapter ?? ""}
        disabled={isPending}
        id={inputId}
        inputMode="numeric"
        key={optimisticChapter}
        onBlur={(event) => handleCommit(event.target.value)}
        type="number"
      />
    </div>
  );
};
