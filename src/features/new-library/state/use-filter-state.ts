/**
 * URL-synced state management for library filters.
 * All filter state lives in the URL for shareability and back/forward navigation.
 */

"use client";

import { createParser, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";
import type { LibraryFilters, ProgressSortBy, ProgressStatus, SortOrder, Source } from "../core/types";
import { isValidProgressStatus, isValidSortBy, isValidSortOrder, isValidSource } from "../core/types";

// ============================================================================
// Custom Parsers
// ============================================================================

const parseAsProgressStatus = createParser({
    parse: (value: string): ProgressStatus | "all" => {
        if (value === "all") return "all";
        if (isValidProgressStatus(value)) return value;
        return "all";
    },
    serialize: (value: ProgressStatus | "all"): string => value,
});

const parseAsProgressSortBy = createParser({
    parse: (value: string): ProgressSortBy => {
        if (isValidSortBy(value)) return value;
        return "updatedAt";
    },
    serialize: (value: ProgressSortBy): string => value,
});

const parseAsSortOrder = createParser({
    parse: (value: string): SortOrder => {
        if (isValidSortOrder(value)) return value;
        return "desc";
    },
    serialize: (value: SortOrder): string => value,
});

const parseAsSource = createParser({
    parse: (value: string): Source | "all" | null => {
        if (value === "all") return null;
        if (isValidSource(value)) return value;
        return null;
    },
    serialize: (value: Source | "all" | null): string => {
        return value ?? "all";
    },
});

// ============================================================================
// Filter Hook
// ============================================================================

interface UseLibraryFiltersReturn {
    readonly filters: LibraryFilters;
    readonly setSearch: (search: string) => void;
    readonly setStatus: (status: ProgressStatus | "all") => void;
    readonly setSortBy: (sortBy: ProgressSortBy) => void;
    readonly setSortOrder: (sortOrder: SortOrder) => void;
    readonly setSource: (source: Source | "all" | null) => void;
    readonly resetFilters: () => void;
}

/**
 * Hook for managing library filters with URL state synchronization.
 * All filter changes are reflected in the URL for shareability.
 */
export function useLibraryFilters(): UseLibraryFiltersReturn {
    const [search, setSearch] = useQueryState("search", {
        defaultValue: "",
        history: "push",
        shallow: false,
    });

    const [status, setStatus] = useQueryState("status", parseAsProgressStatus.withDefault("all"));

    const [sortBy, setSortBy] = useQueryState("sortBy", parseAsProgressSortBy.withDefault("updatedAt"));

    const [sortOrder, setSortOrder] = useQueryState("sortOrder", parseAsSortOrder.withDefault("desc"));

    const [source, setSource] = useQueryState("source", parseAsSource);

    const filters = useMemo<LibraryFilters>(
        () => ({
            search: search || undefined,
            status,
            sortBy,
            sortOrder,
            source: source ?? undefined,
        }),
        [search, status, sortBy, sortOrder, source],
    );

    const resetFilters = useCallback(() => {
        setSearch("");
        setStatus("all");
        setSortBy("updatedAt");
        setSortOrder("desc");
        setSource(null);
    }, [setSearch, setStatus, setSortBy, setSortOrder, setSource]);

    return {
        filters,
        setSearch,
        setStatus,
        setSortBy,
        setSortOrder,
        setSource,
        resetFilters,
    };
}

/**
 * Hook for managing just the search query.
 * Separated for components that only need search.
 */
export function useSearchQuery() {
    const [search, setSearch] = useQueryState("search", {
        defaultValue: "",
        history: "push",
        shallow: false,
    });

    return [search, setSearch] as const;
}
