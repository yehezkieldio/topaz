/**
 * Optimized hook for fetching library data with infinite scroll.
 */

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FIVE_MINUTES, THIRTY_MINUTES } from "#/trpc/query-client";
import { useTRPC } from "#/trpc/react";
import type { LibraryFilters, LibraryStory } from "../core/types";

const RETRY_DELAY_BASE_MS = 1000;
const RETRY_DELAY_MAX_MS = 30_000;
const DEFAULT_PAGE_SIZE = 20;

interface UseLibraryQueryOptions {
    readonly filters: LibraryFilters;
    readonly enabled?: boolean;
}

interface UseLibraryQueryReturn {
    readonly stories: readonly LibraryStory[];
    readonly error: unknown;
    readonly fetchNextPage: () => void;
    readonly hasNextPage: boolean;
    readonly isFetching: boolean;
    readonly isFetchingNextPage: boolean;
    readonly isLoading: boolean;
    readonly refetch: () => void;
}

/**
 * Optimized hook for fetching paginated library data.
 * - Aggressive caching with structural sharing
 * - Optimized refetch policies to minimize network requests
 * - Exponential backoff for retries
 * - Proper memoization of computed values
 */
export function useLibraryQuery({ filters, enabled = true }: UseLibraryQueryOptions): UseLibraryQueryReturn {
    const trpc = useTRPC();

    const queryInput = useMemo(
        () => ({
            search: filters.search || undefined,
            status:
                filters.status === "all" || !filters.status
                    ? undefined
                    : ([
                          filters.status === "reading"
                              ? "Reading"
                              : filters.status === "completed"
                                ? "Completed"
                                : filters.status === "on-hold"
                                  ? "Paused"
                                  : filters.status === "dropped"
                                    ? "Dropped"
                                    : "PlanToRead",
                      ] as (
                          | "NotStarted"
                          | "Reading"
                          | "Paused"
                          | "Completed"
                          | "Dropped"
                          | "PlanToRead"
                          | "DroppedAsAbandoned"
                      )[]),
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
            limit: DEFAULT_PAGE_SIZE,
        }),
        [filters.search, filters.status, filters.sortBy, filters.sortOrder],
    );

    const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, isPending, refetch } =
        useInfiniteQuery(
            trpc.progress.all.infiniteQueryOptions(queryInput, {
                getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
                enabled,
                refetchOnWindowFocus: false,
                refetchOnMount: "always",
                refetchOnReconnect: false,
                refetchInterval: false,
                staleTime: FIVE_MINUTES,
                gcTime: THIRTY_MINUTES,
                retry: 3,
                retryDelay: (attemptIndex) => Math.min(RETRY_DELAY_BASE_MS * 2 ** attemptIndex, RETRY_DELAY_MAX_MS),
                structuralSharing: true,
                notifyOnChangeProps: [
                    "data",
                    "error",
                    "hasNextPage",
                    "isFetching",
                    "isFetchingNextPage",
                    "isLoading",
                    "isPending",
                ],
            }),
        );

    const stories = useMemo(() => {
        return data?.pages.flatMap((page) => page.data) ?? [];
    }, [data?.pages]);

    return {
        stories,
        error,
        fetchNextPage,
        hasNextPage: hasNextPage ?? false,
        isFetching,
        isFetchingNextPage,
        isLoading: isLoading || isPending,
        refetch,
    };
}
