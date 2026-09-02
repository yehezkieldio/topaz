"use client";

import { useMemo } from "react";
import { useLibraryQueryState } from "#/features/library/hooks/use-library-query-state";
import type { SortOrder } from "#/lib/utils";
import type { LibraryEntryStatus, LibrarySortBy, Source } from "#/server/db/schema";

export function useLibraryFilter() {
    const { filters, isPending, setFilters } = useLibraryQueryState();

    return useMemo(
        () => ({
            favorite: filters.favorite,
            hasNotes: filters.hasNotes,
            isNsfw: filters.isNsfw,
            isPending,
            setFavorite: (favorite: "all" | "yes" | "no") => setFilters({ favorite }),
            setHasNotes: (hasNotes: "all" | "yes" | "no") => setFilters({ hasNotes }),
            setIsNsfw: (isNsfw: "all" | "yes" | "no") => setFilters({ isNsfw }),
            setSortBy: (sortBy: LibrarySortBy) => setFilters({ sortBy }),
            setSortOrder: (sortOrder: SortOrder) => setFilters({ sortOrder }),
            setSource: (source: Source | "all") => setFilters({ source }),
            setStatus: (status: LibraryEntryStatus | "all") => setFilters({ status }),
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            source: filters.source,
            status: filters.status,
        }),
        [filters, isPending, setFilters]
    );
}
