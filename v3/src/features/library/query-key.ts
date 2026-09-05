export interface LibraryQueryFilters {
  search?: string;
  status?: string;
  minRating?: number;
  sourcePlatformId?: string;
  contentRating?: string;
  publicationStatus?: string;
  favoriteOnly?: boolean;
  featuredOnly?: boolean;
  taxonomyTermIds?: string[];
  taxonomyMode?: "direct" | "effective";
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
    filters.favoriteOnly ? "1" : "",
    filters.featuredOnly ? "1" : "",
    (filters.taxonomyTermIds ?? []).join(","),
    filters.taxonomyMode ?? "",
  ] as const;
