import { useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { SortOrder } from "#/lib/utils";
import type { ProgressQueryResult } from "#/server/api/routers/progress";
import type { ProgressSortBy, ProgressStatus } from "#/server/db/schema";
import { useTRPC } from "#/trpc/react";

interface UseLibraryDataParams {
    search?: string;
    status?: ProgressStatus | "all" | undefined;
    sortBy: ProgressSortBy;
    sortOrder: SortOrder;
}

interface LibraryDataResult {
    allItems: ProgressQueryResult["data"];
    error: unknown;
    fetchNextPage: () => void;
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    isLoading: boolean;
    refetch: () => void;
}

interface LibraryDataContextValue {
    refetch: () => void;
}

const LibraryDataContext = createContext<LibraryDataContextValue | null>(null);

interface LibraryDataProviderProps extends UseLibraryDataParams {
    children: ReactNode;
}

export function LibraryDataProvider({ children, search, status, sortBy, sortOrder }: LibraryDataProviderProps) {
    const { refetch } = useLibraryData({ search, status, sortBy, sortOrder });

    const contextValue = useMemo(
        () => ({
            refetch,
        }),
        [refetch],
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

export function useLibraryData({ search, status, sortBy, sortOrder }: UseLibraryDataParams): LibraryDataResult {
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
                refetchOnMount: false,
                refetchOnReconnect: false,
                staleTime: Number.POSITIVE_INFINITY,
                gcTime: 1000 * 60 * 30,
                retry: 3,
                retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
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
