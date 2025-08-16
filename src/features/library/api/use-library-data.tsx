"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { LibraryItem } from "#/features/library/hooks/use-library-item";
import type { SortOrder } from "#/lib/utils";
import type { ProgressSortBy, ProgressStatus } from "#/server/db/schema";
import { FIVE_MINUTES, THIRTY_MINUTES } from "#/trpc/query-client";
import { useTRPC } from "#/trpc/react";

type UseLibraryDataParams = {
    search?: string;
    status?: ProgressStatus | "all" | undefined;
    sortBy: ProgressSortBy;
    sortOrder: SortOrder;
};

type LibraryDataContextValue = {
    allItems: LibraryItem[];
    error: unknown;
    fetchNextPage: () => void;
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    refetch: () => void;
};

const LibraryDataContext = createContext<LibraryDataContextValue | null>(null);

interface LibraryDataProviderProps extends UseLibraryDataParams {
    children: ReactNode;
}

export function LibraryDataProvider({ children, search, status, sortBy, sortOrder }: LibraryDataProviderProps) {
    const { allItems, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, refetch } =
        useLibraryData({ search, status, sortBy, sortOrder });

    const contextValue = useMemo(
        () => ({
            allItems,
            error,
            fetchNextPage,
            hasNextPage,
            isFetching,
            isFetchingNextPage,
            isLoading,
            refetch,
        }),
        [allItems, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, refetch],
    );

    return <LibraryDataContext.Provider value={contextValue}>{children}</LibraryDataContext.Provider>;
}

export function useLibraryDataContext(): LibraryDataContextValue {
    const context = useContext(LibraryDataContext);
    if (!context) {
        throw new Error("useLibraryDataContext must be used within LibraryDataProvider");
    }
    return context;
}

export const useLibraryRefetch = () => {
    const context = useContext(LibraryDataContext);
    if (!context) {
        throw new Error("useLibraryRefetch must be used within LibraryDataProvider");
    }
    return context.refetch;
};

const RETRY_DELAY_BASE_MS = 1000;
const RETRY_DELAY_MAX_MS = 30_000;

export function useLibraryData({ search, status, sortBy, sortOrder }: UseLibraryDataParams) {
    const trpc = useTRPC();

    const queryInput = useMemo(
        () => ({
            search: search || undefined,
            status: status === "all" ? undefined : status ? [status] : undefined,
            sortBy,
            sortOrder,
            limit: 20,
        }),
        [search, status, sortBy, sortOrder],
    );

    const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isLoading, isPending, refetch } =
        useInfiniteQuery(
            trpc.progress.all.infiniteQueryOptions(queryInput, {
                getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
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

    const allItems = useMemo(() => {
        return data?.pages.flatMap((page) => page.data) ?? [];
    }, [data?.pages]);

    return {
        allItems,
        error,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        isLoading: isLoading || isPending,
        refetch,
    };
}
