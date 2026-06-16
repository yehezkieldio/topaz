"use client";

import { useMemo } from "react";
import { useLibraryQueryState } from "#/features/library/hooks/use-library-query-state";
import type { SortOrder } from "#/lib/utils";
import type { ProgressSortBy, ProgressStatus, Source } from "#/server/db/schema";

export function useLibraryFilter() {
    const { filters, isPending, setFilters } = useLibraryQueryState();

    return useMemo(
        () => ({
            isPending,
            status: filters.status,
            setStatus: (status: ProgressStatus | "all") => setFilters({ status }),
            source: filters.source,
            setSource: (source: Source | "all") => setFilters({ source }),
            favorite: filters.favorite,
            setFavorite: (favorite: "all" | "yes" | "no") => setFilters({ favorite }),
            isNsfw: filters.isNsfw,
            setIsNsfw: (isNsfw: "all" | "yes" | "no") => setFilters({ isNsfw }),
            hasNotes: filters.hasNotes,
            setHasNotes: (hasNotes: "all" | "yes" | "no") => setFilters({ hasNotes }),
            sortBy: filters.sortBy,
            setSortBy: (sortBy: ProgressSortBy) => setFilters({ sortBy }),
            sortOrder: filters.sortOrder,
            setSortOrder: (sortOrder: SortOrder) => setFilters({ sortOrder }),
        }),
        [filters, isPending, setFilters]
    );
}
