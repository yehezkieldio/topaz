"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

import { libraryQueryKey } from "@/features/library/query-key";
import type { LibraryQueryFilters } from "@/features/library/query-key";
import type {
  LibraryListPage,
  LibraryListRow,
} from "@/features/library/server/queries";

import { WorkCard, WorkCardSkeleton } from "./work-card";

const ESTIMATED_ROW_HEIGHT = 72;
const OVERSCAN = 5;

const fetchLibraryPage = async (
  filters: LibraryQueryFilters,
  cursor: string | null
): Promise<LibraryListPage> => {
  const url = new URL("/api/library", window.location.origin);
  if (filters.search) {
    url.searchParams.set("q", filters.search);
  }
  if (filters.status) {
    url.searchParams.set("status", filters.status);
  }
  if (filters.minRating) {
    url.searchParams.set("minRating", String(filters.minRating));
  }
  if (filters.sourcePlatformId) {
    url.searchParams.set("source", filters.sourcePlatformId);
  }
  if (filters.contentRating) {
    url.searchParams.set("contentRating", filters.contentRating);
  }
  if (filters.publicationStatus) {
    url.searchParams.set("publicationStatus", filters.publicationStatus);
  }
  if (filters.favoriteOnly) {
    url.searchParams.set("favorite", "1");
  }
  if (filters.featuredOnly) {
    url.searchParams.set("featured", "1");
  }
  if (filters.taxonomyTermIds && filters.taxonomyTermIds.length > 0) {
    url.searchParams.set("tags", filters.taxonomyTermIds.join(","));
    url.searchParams.set("tagMode", filters.taxonomyMode ?? "effective");
  }
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch library page");
  }
  return (await response.json()) as LibraryListPage;
};

export const LibraryListVirtualized = ({
  filters,
  initialPage,
  sourcePlatforms,
}: {
  filters: LibraryQueryFilters;
  initialPage: LibraryListPage;
  sourcePlatforms: { id: string; name: string }[];
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const queryKey = libraryQueryKey(filters);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      // initialDataUpdatedAt marks page one as fresh -- without it, TanStack
      // Query treats seeded initialData as stale-since-forever and refetches
      // page one immediately on mount, racing the RSC render's own in-flight
      // "use cache" call for the identical args.
      initialData: { pageParams: [null], pages: [initialPage] },
      initialDataUpdatedAt: Date.now(),
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }) => fetchLibraryPage(filters, pageParam),
      queryKey,
      staleTime: 60 * 1000,
    });

  const rows: LibraryListRow[] =
    data?.pages.flatMap((page) => page.items) ?? [];

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? rows.length + 1 : rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    getScrollElement: () => parentRef.current,
    overscan: OVERSCAN,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVirtualIndex = virtualItems.at(-1)?.index;
  // A second, synchronous guard alongside isFetchingNextPage: several
  // virtualizer re-renders can fire in quick succession before React commits
  // the isFetchingNextPage state update from the first trigger, so a ref-based
  // mutex (set on trigger, cleared once the fetch settles) stops the *trigger*
  // itself from firing twice -- a different problem from TanStack Query's own
  // in-flight-request dedupe.
  const isTriggeringNextPage = useRef(false);

  useEffect(() => {
    if (lastVirtualIndex === undefined) {
      return;
    }
    if (
      lastVirtualIndex >= rows.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isTriggeringNextPage.current
    ) {
      isTriggeringNextPage.current = true;
      const settle = async () => {
        try {
          await fetchNextPage();
        } finally {
          isTriggeringNextPage.current = false;
        }
      };
      void settle();
    }
  }, [
    lastVirtualIndex,
    rows.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  return (
    <div
      className="border-border/60 h-[70vh] overflow-auto rounded-md border"
      ref={parentRef}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const row = rows[virtualItem.index];
          return (
            <div
              data-index={virtualItem.index}
              key={virtualItem.key}
              ref={rowVirtualizer.measureElement}
              style={{
                left: 0,
                position: "absolute",
                top: 0,
                transform: `translateY(${virtualItem.start}px)`,
                width: "100%",
              }}
            >
              {row ? (
                <WorkCard row={row} sourcePlatforms={sourcePlatforms} />
              ) : (
                <WorkCardSkeleton />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
