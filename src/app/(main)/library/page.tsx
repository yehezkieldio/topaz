import { Suspense } from "react";
import { AuthUserGate } from "#/components/auth-user-gate";
import { LibraryClientProvider } from "#/features/library/components/list/library-client";
import { createLibraryQueryInput, type LibrarySearchParams } from "#/features/library/search-params";
import { librarySearchParamsCache } from "#/features/library/search-params.server";
import { getQueryClient, HydrateClient, trpc } from "#/trpc/server";

type LibraryPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Library({ searchParams }: LibraryPageProps) {
    const filters = await librarySearchParamsCache.parse(searchParams);

    return (
        <Suspense fallback={<div>Loading library...</div>}>
            <LibraryServerData initialFilters={filters} />
        </Suspense>
    );
}

async function LibraryServerData({ initialFilters }: { initialFilters: LibrarySearchParams }) {
    const queryClient = getQueryClient();
    await queryClient.prefetchInfiniteQuery(
        trpc.progress.all.infiniteQueryOptions(createLibraryQueryInput(initialFilters), {
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
