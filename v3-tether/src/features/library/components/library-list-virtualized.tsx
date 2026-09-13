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

const ESTIMATED_ROW_HEIGHT = 92;
// Deliberately large -- this keeps a deep buffer of already-rendered rows
// above and below the viewport so a fast scroll (mouse wheel flick, drag,
// Page Down) never outruns the buffer and exposes an unrendered skeleton row.
// (A previous attempt to paper over a too-small buffer by swapping rows to
// WorkCardSkeleton while rowVirtualizer.isScrolling was true backfired: the
// skeleton and the real card measure to different heights, so every swap
// changed getTotalSize(), which nudged the scroll position, which kept
// isScrolling true -- an actual render loop. Don't reintroduce that.)
const OVERSCAN = 30;
// Trigger the next page well before the user reaches the last loaded row,
// not right as they hit it -- fetch latency alone (not just render cost)
// is what causes the visible blank flash the virtualizer "struggles" with.
const PREFETCH_ROW_THRESHOLD = 12;

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
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch library page");
  }
  // SAFETY: this fetches our own /api/library route (src/app/api/library/route.ts),
  // which serializes exactly getLibraryList's `LibraryListPage` shape via
  // NextResponse.json -- there is no external/untrusted producer of this response.
  return (await response.json()) as LibraryListPage;
};

export const LibraryListVirtualized = ({
  filters,
  initialPage,
  isAdmin,
  sourcePlatforms,
}: {
  filters: LibraryQueryFilters;
  initialPage: LibraryListPage;
  isAdmin: boolean;
  sourcePlatforms: { id: string; name: string; baseUrl: string | null }[];
}) => {
  // TanStack Virtual's useVirtualizer relies on interior mutability (its
  // returned instance is a mutable object the library updates in place),
  // which the React Compiler can't safely memoize -- there's no memo-safe
  // replacement upstream yet, so this component opts out of compilation
  // rather than risk the compiler caching a stale virtualizer snapshot.
  "use no memo";

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
      // SAFETY: initialPageParam must be null (page one, no cursor yet) but
      // useInfiniteQuery infers TPageParam from this literal -- without the
      // annotation it would narrow to the literal type `null`, which can't
      // widen to accept the `string | null` cursor getNextPageParam returns.
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
    // measureElement fires during commit (as a ref callback) and the
    // virtualizer then calls flushSync to apply the measurement
    // synchronously. React 19 forbids flushSync inside a lifecycle/commit
    // ("flushSync was called from inside a lifecycle method"), so opt out
    // and let the measurement rerender schedule normally instead.
    useFlushSync: false,
    // Keyed by the row's own stable id (not index) so a row that's already
    // been measured keeps its cached size across re-renders/pagination
    // instead of every index silently inheriting whatever the previous
    // occupant of that slot measured to.
    getItemKey: (index) =>
      rows[index]?.libraryEntryPublicId ?? `pending-${index}`,
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
      lastVirtualIndex >= rows.length - 1 - PREFETCH_ROW_THRESHOLD &&
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
      className="h-[calc(100dvh-110px)] w-full overflow-auto"
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
                <WorkCard
                  isAdmin={isAdmin}
                  row={row}
                  sourcePlatforms={sourcePlatforms}
                />
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
