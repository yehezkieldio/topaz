/**
 * Hook for computing story-derived values with optimized memoization.
 */

"use client";

import { useMemo } from "react";
import { computeStoryValues } from "../core/domain";
import type { ComputedStoryValues, LibraryStory } from "../core/types";

/**
 * Hook that computes all derived values for a library story.
 * Only recomputes when relevant story properties change.
 */
export function useStoryValues(story: LibraryStory): ComputedStoryValues {
    return useMemo(() => computeStoryValues(story), [story]);
}
