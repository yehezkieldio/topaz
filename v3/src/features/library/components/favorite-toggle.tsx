"use client";

import { StarIcon } from "lucide-react";
import { startTransition, useActionState, useOptimistic } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MutationResult } from "@/server/query/mutation-result";

interface FavoriteState {
  favorite: boolean;
  version: number;
}

export const FavoriteToggle = ({
  favorite,
  libraryEntryPublicId,
  toggleFavoriteAction,
  version,
}: {
  libraryEntryPublicId: string;
  favorite: boolean;
  version: number;
  toggleFavoriteAction: (
    libraryEntryPublicId: string,
    expectedVersion: number
  ) => Promise<MutationResult<FavoriteState>>;
}) => {
  const [state, dispatch, isPending] =
    useActionState<MutationResult<FavoriteState> | null>(async (previous) => {
      const currentVersion =
        previous?.status === "success" ? previous.data.version : version;
      return await toggleFavoriteAction(libraryEntryPublicId, currentVersion);
    }, null);

  const committedFavorite =
    state?.status === "success" ? state.data.favorite : favorite;
  const [optimisticFavorite, setOptimisticFavorite] =
    useOptimistic(committedFavorite);

  const handleClick = () => {
    startTransition(() => {
      setOptimisticFavorite((prev) => !prev);
      dispatch();
    });
  };

  return (
    <Button
      aria-label={optimisticFavorite ? "Unfavorite" : "Favorite"}
      aria-pressed={optimisticFavorite}
      className="size-8 p-0"
      disabled={isPending}
      onClick={handleClick}
      size="sm"
      variant="ghost"
    >
      <StarIcon
        className={cn(
          "size-4",
          optimisticFavorite && "fill-foreground text-foreground"
        )}
      />
    </Button>
  );
};
