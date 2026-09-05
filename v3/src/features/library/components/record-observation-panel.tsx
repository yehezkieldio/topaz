"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ObservationCounts,
  recordSourceObservationAction,
} from "@/features/catalog/server/observation-actions";
import type { MutationResult } from "@/server/query/mutation-result";

const PUBLICATION_STATUSES = [
  "in_progress",
  "completed",
  "hiatus",
  "abandoned",
] as const;

const formatOption = (value: string) => value.replaceAll("_", " ");

const parseCount = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : Math.max(0, Math.trunc(parsed));
};

/**
 * Manual "record a refresh" control for work_source_observation
 * (v3/plan-work.md Slice B) -- a self-contained mutation, separate from the
 * work-edit TanStack form, since it targets a different table with its own
 * insert-only-on-change semantics.
 */
export const RecordObservationPanel = ({
  initialChapterCount,
  initialPublicationStatus,
  initialWordCount,
  recordAction,
  workSourcePublicId,
}: {
  workSourcePublicId: string;
  initialChapterCount: number | null;
  initialWordCount: number | null;
  initialPublicationStatus: (typeof PUBLICATION_STATUSES)[number] | null;
  recordAction: typeof recordSourceObservationAction;
}) => {
  const chapterId = useId();
  const wordId = useId();
  const [chapterCount, setChapterCount] = useState(
    initialChapterCount?.toString() ?? ""
  );
  const [wordCount, setWordCount] = useState(
    initialWordCount?.toString() ?? ""
  );
  const [publicationStatus, setPublicationStatus] = useState<
    (typeof PUBLICATION_STATUSES)[number] | null
  >(initialPublicationStatus);

  const [state, dispatch, isPending] = useActionState<
    MutationResult<{ status: "recorded" | "noop" }> | null,
    ObservationCounts
  >(
    async (_previous, counts) =>
      await recordAction(workSourcePublicId, counts, "manual"),
    null
  );

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">Record refresh</p>
      <p className="text-muted-foreground text-xs">
        Logs a work_source_observation row only if these values differ from the
        last one recorded.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={chapterId}>Chapters</Label>
          <Input
            id={chapterId}
            inputMode="numeric"
            onChange={(event) => setChapterCount(event.target.value)}
            type="number"
            value={chapterCount}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={wordId}>Words</Label>
          <Input
            id={wordId}
            inputMode="numeric"
            onChange={(event) => setWordCount(event.target.value)}
            type="number"
            value={wordCount}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Publication status</Label>
        <Select
          onValueChange={(value) =>
            setPublicationStatus(value as (typeof PUBLICATION_STATUSES)[number])
          }
          value={publicationStatus ?? undefined}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unknown" />
          </SelectTrigger>
          <SelectContent>
            {PUBLICATION_STATUSES.map((statusValue) => (
              <SelectItem key={statusValue} value={statusValue}>
                {formatOption(statusValue)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        disabled={isPending}
        onClick={() => {
          dispatch({
            chapterCount: parseCount(chapterCount),
            publicationStatus,
            wordCount: parseCount(wordCount),
          });
        }}
        size="sm"
        type="button"
      >
        {isPending ? "Recording..." : "Record refresh"}
      </Button>
      {state?.status === "success" && (
        <p className="text-muted-foreground text-xs">
          {state.data.status === "recorded"
            ? "Observation recorded."
            : "No change -- nothing written."}
        </p>
      )}
      {state?.status === "not-found" && (
        <p className="text-destructive text-xs">
          This source no longer exists.
        </p>
      )}
    </div>
  );
};
