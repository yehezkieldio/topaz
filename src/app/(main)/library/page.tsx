import { Suspense } from "react";
import { AuthUserGate } from "#/components/auth-user-gate";
import { LibraryClientProvider } from "#/features/library/components/list/library-client";
import { createLibraryQueryInput, type LibrarySearchParams } from "#/features/library/search-params";
import { librarySearchParamsCache } from "#/features/library/search-params.server";
import { getQueryClient, HydrateClient, trpc } from "#/trpc/server";

export const metadata = {
    title: "Library | Topaz",
    description: "Browse the Topaz story library.",
};

type LibraryPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Library({ searchParams }: LibraryPageProps) {
    return (
        <Suspense fallback={<div>Loading library…</div>}>
            <LibraryServerData searchParams={searchParams} />
        </Suspense>
    );
}

async function LibraryServerData({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const initialFilters: LibrarySearchParams = await librarySearchParamsCache.parse(searchParams);
    const queryClient = getQueryClient();
    await queryClient.prefetchInfiniteQuery(
        trpc.library.all.infiniteQueryOptions(createLibraryQueryInput(initialFilters), {
            getNextPageParam: (lastPage) => lastPage.meta.nextCursor,
            initialCursor: undefined,
        })
    );

    return (
        <HydrateClient>
            <AuthUserGate>
                {(isAdministratorUser) => (
                    <LibraryClientProvider initialFilters={initialFilters} isAdministratorUser={isAdministratorUser} />
                )}
            </AuthUserGate>
        </HydrateClient>
    );
}
