import { Suspense } from "react";
import { AuthUserGate } from "#/components/auth-user-gate";
import { LibraryClientProvider, LibraryShell } from "#/features/library/components/list/library-client";
import { LibraryPageSkeleton } from "#/features/library/components/skeletons/library-page-skeleton";
import { createLibraryQueryInput, type LibrarySearchParams } from "#/features/library/search-params";
import { librarySearchParamsCache } from "#/features/library/search-params.server";
import { getQueryClient, HydrateClient, trpc } from "#/trpc/server";

export const metadata = {
    description: "Browse the Topaz story library.",
    title: "Library | Topaz",
};

type LibraryPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Library({ searchParams }: LibraryPageProps) {
    return (
        <LibraryShell>
            <Suspense fallback={<LibraryPageSkeleton />}>
                <LibraryServerData searchParams={searchParams} />
            </Suspense>
        </LibraryShell>
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
