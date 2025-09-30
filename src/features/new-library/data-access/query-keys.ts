/**
 * Query key factory for consistent cache management.
 */

import type { LibraryFilters } from "../core/types";

export const libraryKeys = {
    all: ["library"] as const,
    lists: () => [...libraryKeys.all, "list"] as const,
    list: (filters: Partial<LibraryFilters>) => [...libraryKeys.lists(), filters] as const,
    details: () => [...libraryKeys.all, "detail"] as const,
    detail: (id: string) => [...libraryKeys.details(), id] as const,
    stats: () => [...libraryKeys.all, "stats"] as const,
    search: {
        fandoms: (query: string) => [...libraryKeys.all, "search", "fandoms", query] as const,
        tags: (query: string) => [...libraryKeys.all, "search", "tags", query] as const,
    },
} as const;
