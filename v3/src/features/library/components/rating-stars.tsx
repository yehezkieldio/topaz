"use client";

import { StarIcon } from "lucide-react";
import { startTransition, useActionState, useId, useOptimistic } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MutationResult } from "@/server/query/mutation-result";

interface RatingState {
  rating: number | null;
  version: number;
}

const RATING_MIN = 1;
const RATING_MAX = 10;
const RATING_STEP = 0.5;

const formatRating = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const clampRating = (raw: number) => {
  const stepped = Math.round(raw / RATING_STEP) * RATING_STEP;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, stepped));
};

export const RatingBadge = ({ rating }: { rating: number | null }) =>
  rating === null ? (
    <span className="text-muted-foreground text-xs">Not rated</span>
  ) : (
    <span className="text-foreground inline-flex items-center gap-1 text-xs font-medium">
      <StarIcon className="fill-foreground text-foreground size-3" />
      {formatRating(rating)}
      <span className="text-muted-foreground font-normal">/10</span>
    </span>
  );

export const RatingStars = ({
  libraryEntryPublicId,
  rating,
  updateRatingAction,
  version,
}: {
  libraryEntryPublicId: string;
  rating: number | null;
  version: number;
  updateRatingAction: (
    libraryEntryPublicId: string,
    expectedVersion: number,
    rating: number | null
  ) => Promise<MutationResult<RatingState>>;
}) => {
  const inputId = useId();

  const [state, dispatch, isPending] = useActionState<
    MutationResult<RatingState> | null,
    number | null
  >(async (previous, nextRating) => {
    const currentVersion =
      previous?.status === "success" ? previous.data.version : version;
    return await updateRatingAction(
      libraryEntryPublicId,
      currentVersion,
      nextRating
    );
  }, null);

  const committedRating =
    state?.status === "success" ? state.data.rating : rating;
  const [optimisticRating, setOptimisticRating] =
    useOptimistic(committedRating);

  const handleCommit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (optimisticRating === null) {
        return;
      }
      startTransition(() => {
        setOptimisticRating(null);
        dispatch(null);
      });
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      return;
    }
    const nextRating = clampRating(parsed);
    if (nextRating === optimisticRating) {
      return;
    }

    startTransition(() => {
      setOptimisticRating(nextRating);
      dispatch(nextRating);
    });
  };

  return (
    <div className={cn("relative", isPending && "opacity-60")}>
      <StarIcon
        className={cn(
          "text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2",
          optimisticRating !== null && "fill-foreground text-foreground"
        )}
      />
      <Input
        aria-label="Rating out of 10"
        className="no-spinner rounded-md pr-10 pl-9 tabular-nums"
        defaultValue={
          optimisticRating === null ? "" : formatRating(optimisticRating)
        }
        disabled={isPending}
        id={inputId}
        inputMode="decimal"
        key={optimisticRating}
        max={RATING_MAX}
        min={RATING_MIN}
        onBlur={(event) => handleCommit(event.target.value)}
        placeholder="Not rated"
        step={RATING_STEP}
        type="number"
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
        /10
      </span>
    </div>
  );
};
