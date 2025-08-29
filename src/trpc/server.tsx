import "server-only";

import {
    type FetchInfiniteQueryOptions,
    type FetchQueryOptions,
    HydrationBoundary,
    dehydrate,
} from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { appRouter } from "#/server/api/root";
import { createTRPCContext } from "#/server/api/trpc";
import { createQueryClient } from "#/trpc/query-client";

export const getQueryClient = cache(createQueryClient);

export const trpc = createTRPCOptionsProxy({
    ctx: createTRPCContext,
    router: appRouter,
    queryClient: getQueryClient,
});

export const caller = appRouter.createCaller(createTRPCContext);

export function HydrateClient(props: { children: React.ReactNode }) {
    const queryClient = getQueryClient();
    return <HydrationBoundary state={dehydrate(queryClient)}>{props.children}</HydrationBoundary>;
}

type PrefetchQueryOptions<
    TQueryFnData = unknown,
    TError = unknown,
    TData = TQueryFnData,
    TQueryKey extends readonly unknown[] = unknown[],
> =
    | FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
    | FetchInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey>;

function isInfiniteQuery<TQueryFnData, TError, TData, TQueryKey extends readonly unknown[]>(
    options: PrefetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): options is FetchInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey> {
    return "initialPageParam" in options && options.initialPageParam !== undefined;
}

export async function prefetch<
    TQueryFnData = unknown,
    TError = unknown,
    TData = TQueryFnData,
    TQueryKey extends readonly unknown[] = unknown[],
>(queryOptions: PrefetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>) {
    const queryClient = getQueryClient();
    if (isInfiniteQuery(queryOptions)) {
        await queryClient.prefetchInfiniteQuery(queryOptions);
    } else {
        await queryClient.prefetchQuery(queryOptions);
    }
}
