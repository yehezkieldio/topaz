/**
 * Larger than the generic `DEFAULT_PAGE_SIZE` -- the virtualized list wants
 * a deep buffer of already-fetched rows so fast scrolling never outruns the
 * network and exposes unrendered skeleton rows.
 */
export const LIBRARY_PAGE_SIZE = 40;

export interface LibraryQueryFilters {
  search?: string;
  status?: string;
  minRating?: number;
  sourcePlatformId?: string;
  contentRating?: string;
  publicationStatus?: string;
}

/**
 * Shared between the server-side prefetch (LibraryResults) and the client
 * useInfiniteQuery call (LibraryListVirtualized) -- a mismatched key means
 * the client re-fetches page one instead of hydrating the server's page.
 */
export const libraryQueryKey = (filters: LibraryQueryFilters) =>
  [
    "library",
    filters.search ?? "",
    filters.status ?? "",
    filters.minRating ?? "",
    filters.sourcePlatformId ?? "",
    filters.contentRating ?? "",
    filters.publicationStatus ?? "",
  ] as const;
