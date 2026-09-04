import type { SearchParams } from "nuqs/server";

import { LibraryListVirtualized } from "@/features/library/components/library-list-virtualized";
import { librarySearchParamsCache } from "@/features/library/search-params";
import { getLibraryList } from "@/features/library/server/queries";

import { WorkCardSkeleton } from "./work-card";

export const LibraryResults = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) => {
  const { q, status } = await librarySearchParamsCache.parse(searchParams);
  const filters = { search: q || undefined, status: status ?? undefined };
  const initialPage = await getLibraryList(filters);

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

  return <LibraryListVirtualized filters={filters} initialPage={initialPage} />;
};

const SKELETON_ROWS = ["a", "b", "c", "d", "e", "f"];

export const LibraryResultsSkeleton = () => (
  <div className="divide-border/60 border-border/60 divide-y rounded-md border">
    {SKELETON_ROWS.map((key) => (
      <WorkCardSkeleton key={key} />
    ))}
  </div>
);
