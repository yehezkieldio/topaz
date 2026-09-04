"use client";

import { StarIcon } from "lucide-react";
import { startTransition, useActionState, useId, useOptimistic } from "react";

import { cn } from "@/lib/utils";
import type { MutationResult } from "@/server/query/mutation-result";

interface RatingState {
  rating: number | null;
  version: number;
}

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

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
  const groupName = useId();

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

  const handleSelect = (nextRating: number | null) => {
    startTransition(() => {
      setOptimisticRating(nextRating);
      dispatch(nextRating);
    });
  };

  return (
    <fieldset aria-label="Rating" className="m-0 flex gap-0.5 border-0 p-0">
      {RATING_VALUES.map((value) => {
        const filled = optimisticRating !== null && value <= optimisticRating;
        const inputId = `${groupName}-${value}`;
        return (
          <label
            className="cursor-pointer leading-none has-disabled:cursor-not-allowed has-disabled:opacity-50"
            htmlFor={inputId}
            key={value}
          >
            <input
              checked={value === optimisticRating}
              className="sr-only"
              disabled={isPending}
              id={inputId}
              name={groupName}
              onChange={() =>
                handleSelect(value === optimisticRating ? null : value)
              }
              type="radio"
              value={value}
            />
            <StarIcon
              className={cn(
                "text-muted-foreground size-3.5",
                filled && "fill-foreground text-foreground"
              )}
            />
          </label>
        );
      })}
    </fieldset>
  );
};
