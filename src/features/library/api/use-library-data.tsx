"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, use, useCallback, useMemo } from "react";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import { useLibraryQueryState } from "#/features/library/hooks/use-library-query-state";
import { createLibraryQueryInput, type LibrarySearchParams } from "#/features/library/search-params";
import { FIVE_MINUTES, THIRTY_MINUTES } from "#/trpc/query-client";
import { useTRPC } from "#/trpc/react";

type LibraryDataStatus = "pending" | "error" | "empty" | "ready";

type LibraryDataContextValue = {
    allItems: LibraryItem[];
    actions: {
        fetchNextPage: () => Promise<unknown>;
        invalidate: () => Promise<void>;
    };
    error: unknown;
    fetchNextPage: () => Promise<unknown>;
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    invalidate: () => Promise<void>;
    meta: {
        itemCount: number;
        status: LibraryDataStatus;
    };
};

const LibraryDataContext = createContext<LibraryDataContextValue | null>(null);

interface LibraryDataProviderProps {
    children: ReactNode;
    initialFilters: LibrarySearchParams;
}

export function LibraryDataProvider({ children, initialFilters }: LibraryDataProviderProps) {
    const { filters } = useLibraryQueryState();
    const activeFilters = useMemo(() => ({ ...initialFilters, ...filters }), [filters, initialFilters]);
    const { allItems, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, invalidate } =
        useLibraryData(activeFilters);
    const status = getLibraryDataStatus({ error, isLoading, itemCount: allItems.length });

    const contextValue = useMemo(
        () => ({
            allItems,
            actions: {
                fetchNextPage,
                invalidate,
            },
            error,
            fetchNextPage,
            hasNextPage,
            isFetching,
            isFetchingNextPage,
            isLoading,
            invalidate,
            meta: {
                itemCount: allItems.length,
                status,
            },
        }),
        [allItems, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, invalidate, status]
    );

    return <LibraryDataContext.Provider value={contextValue}>{children}</LibraryDataContext.Provider>;
}

export function useLibraryDataContext(): LibraryDataContextValue {
    const context = use(LibraryDataContext);
    if (!context) {
        throw new Error("useLibraryDataContext must be used within LibraryDataProvider");
    }
    return context;
}

export const useLibraryRefetch = () => {
    const context = use(LibraryDataContext);
    if (!context) {
        throw new Error("useLibraryRefetch must be used within LibraryDataProvider");
    }
    return context.invalidate;
};

function getLibraryDataStatus({
    error,
    isLoading,
    itemCount,
}: {
    error: unknown;
    isLoading: boolean;
    itemCount: number;
}): LibraryDataStatus {
    if (isLoading) return "pending";
    if (error) return "error";
    if (itemCount === 0) return "empty";
    return "ready";
}

const RETRY_DELAY_BASE_MS = 1000;
const RETRY_DELAY_MAX_MS = 30_000;

export function useLibraryData(filters: LibrarySearchParams) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const queryInput = useMemo(() => createLibraryQueryInput(filters), [filters]);

    const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, isPending } =
        useInfiniteQuery(
            trpc.library.all.infiniteQueryOptions(queryInput, {
                getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
                refetchOnWindowFocus: false,
                refetchOnMount: false,
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
            })
        );

    const allItems = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data?.pages]);
    const invalidate = useCallback(async () => {
        await queryClient.invalidateQueries(trpc.library.all.queryFilter(), {
            cancelRefetch: false,
        });
    }, [queryClient, trpc]);

    return {
        allItems,
        error,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        isLoading: isLoading || isPending,
        invalidate,
    };
}
