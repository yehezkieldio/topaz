import type { SearchParams } from "nuqs/server";

import { LibraryListVirtualized } from "@/features/library/components/library-list-virtualized";
import { librarySearchParamsCache } from "@/features/library/search-params";
import { getLibraryList } from "@/features/library/server/queries";
import { getSourcePlatforms } from "@/features/library/server/source-platforms-query";

import { WorkCardSkeleton } from "./work-card";

export const LibraryResults = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const {
    contentRating,
    favorite,
    featured,
    minRating,
    publicationStatus,
    q,
    source,
    status,
    tagMode,
    tags,
  } = await librarySearchParamsCache.parse(searchParams);
  const filters = {
    contentRating: contentRating ?? undefined,
    favoriteOnly: favorite ?? undefined,
    featuredOnly: featured ?? undefined,
    minRating: minRating ?? undefined,
    publicationStatus: publicationStatus ?? undefined,
    search: q || undefined,
    sourcePlatformId: source ?? undefined,
    status: status ?? undefined,
    taxonomyMode: tagMode ?? undefined,
    taxonomyTermIds: tags && tags.length > 0 ? tags : undefined,
  };
  const [initialPage, sourcePlatforms] = await Promise.all([
    getLibraryList(filters),
    getSourcePlatforms(),
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
      sourcePlatforms={sourcePlatforms}
    />
  );
};

const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"];

export const LibraryResultsSkeleton = () => (
  <div className="divide-border/60 border-border/60 divide-y rounded-md border">
    {SKELETON_ROWS.map((key) => (
      <WorkCardSkeleton key={key} />
    ))}
  </div>
);
