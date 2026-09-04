export interface LibraryQueryFilters {
  search?: string;
  status?: string;
}

/**
 * Shared between the server-side prefetch (LibraryResults) and the client
 * useInfiniteQuery call (LibraryListVirtualized) -- a mismatched key means
 * the client re-fetches page one instead of hydrating the server's page.
 */
export const libraryQueryKey = (filters: LibraryQueryFilters) =>
  ["library", filters.search ?? "", filters.status ?? ""] as const;
