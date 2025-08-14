import { createParser, useQueryState } from "nuqs";
import type { SortOrder } from "#/lib/utils";
import type { ProgressSortBy, ProgressStatus, Source } from "#/server/db/schema";

export const parseAsSource = createParser({
    parse: (value: string): Source | null => {
        if (value === "all") return null;
        return value as Source;
    },
    serialize: (value: Source | null): string => {
        return value ?? "all";
    },
});

export const parseAsProgressSortBy = createParser({
    parse: (value: string): ProgressSortBy => value as ProgressSortBy,
    serialize: (value: ProgressSortBy): string => value,
});

export const parseAsSortOrder = createParser({
    parse: (value: string): SortOrder | null => {
        if (value === "asc") return "asc";
        if (value === "desc") return "desc";
        return null;
    },
    serialize: (value: SortOrder | null): string => value ?? "asc",
});

export const parseAsProgressStatus = createParser({
    parse: (value: string): ProgressStatus | "all" => {
        if (value === "all") return "all";
        return value as ProgressStatus;
    },
    serialize: (value: ProgressStatus | "all"): string => {
        return value === "all" ? "all" : value;
    },
});

export function useLibraryFilter() {
    const [source, setSource] = useQueryState("source", parseAsSource);
    const [sortBy, setSortBy] = useQueryState("sortBy", parseAsProgressSortBy.withDefault("updatedAt"));
    const [sortOrder, setSortOrder] = useQueryState("sortOrder", parseAsSortOrder.withDefault("desc"));
    const [status, setStatus] = useQueryState("status", parseAsProgressStatus.withDefault("all"));

    return {
        status,
        setStatus,
        source,
        setSource,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
    };
}
