import type { SearchParams } from "nuqs/server";

import { LibraryListVirtualized } from "@/features/library/components/library-list-virtualized";
import { LIBRARY_PAGE_SIZE } from "@/features/library/query-key";
import { librarySearchParamsCache } from "@/features/library/search-params";
import { getLibraryList } from "@/features/library/server/queries";
import { getSourcePlatforms } from "@/features/library/server/source-platforms-query";
import { getIsAdmin } from "@/server/auth/get-is-admin";

import { WorkCardSkeleton } from "./work-card";

export const LibraryResults = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const { contentRating, minRating, publicationStatus, q, source, status } =
    await librarySearchParamsCache.parse(searchParams);
  const filters = {
    contentRating: contentRating ?? undefined,
    minRating: minRating ?? undefined,
    publicationStatus: publicationStatus ?? undefined,
    search: q || undefined,
    sourcePlatformId: source ?? undefined,
    status: status ?? undefined,
  };
  const [initialPage, sourcePlatforms, isAdmin] = await Promise.all([
    getLibraryList({ ...filters, limit: LIBRARY_PAGE_SIZE }),
    getSourcePlatforms(),
    getIsAdmin(),
  ]);

  if (initialPage.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h3 className="font-serif text-lg font-semibold">No entries found</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Nothing in the library matches the current search and filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <LibraryListVirtualized
      filters={filters}
      initialPage={initialPage}
      isAdmin={isAdmin}
      sourcePlatforms={sourcePlatforms}
    />
  );
};

const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"];

export const LibraryResultsSkeleton = () => (
  <div className="divide-border/60 w-full divide-y">
    {SKELETON_ROWS.map((key) => (
      <WorkCardSkeleton key={key} />
    ))}
  </div>
);
