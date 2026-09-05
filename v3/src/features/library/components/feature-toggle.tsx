"use client";

import { PinIcon } from "lucide-react";
import { startTransition, useActionState, useOptimistic } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MutationResult } from "@/server/query/mutation-result";

interface FeaturedState {
  isFeatured: boolean;
  displayOrder: number | null;
  version: number;
}

export const FeatureToggle = ({
  isFeatured,
  libraryEntryPublicId,
  toggleFeaturedAction,
  version,
}: {
  libraryEntryPublicId: string;
  isFeatured: boolean;
  version: number;
  toggleFeaturedAction: (
    libraryEntryPublicId: string,
    expectedVersion: number
  ) => Promise<MutationResult<FeaturedState>>;
}) => {
  const [state, dispatch, isPending] =
    useActionState<MutationResult<FeaturedState> | null>(async (previous) => {
      const currentVersion =
        previous?.status === "success" ? previous.data.version : version;
      return await toggleFeaturedAction(libraryEntryPublicId, currentVersion);
    }, null);

  const committedFeatured =
    state?.status === "success" ? state.data.isFeatured : isFeatured;
  const [optimisticFeatured, setOptimisticFeatured] =
    useOptimistic(committedFeatured);

  const handleClick = () => {
    startTransition(() => {
      setOptimisticFeatured((prev) => !prev);
      dispatch();
    });
  };

  return (
    <Button
      aria-label={optimisticFeatured ? "Unfeature" : "Feature"}
      aria-pressed={optimisticFeatured}
      className="size-8 p-0"
      disabled={isPending}
      onClick={handleClick}
      size="sm"
      variant="ghost"
    >
      <PinIcon
        className={cn(
          "size-4",
          optimisticFeatured && "fill-foreground text-foreground"
        )}
      />
    </Button>
  );
};
