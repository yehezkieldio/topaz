import { debounce, type inferParserType, parseAsString, parseAsStringEnum } from "nuqs";
import type { SortOrder } from "#/lib/utils";
import type { ProgressSortBy, ProgressStatus, Source } from "#/server/db/schema";

export const LIBRARY_PAGE_SIZE = 20;
export const LIBRARY_SEARCH_DEBOUNCE_MS = 400;

export const LIBRARY_SOURCE_OPTIONS = [
    "ArchiveOfOurOwn",
    "FanFictionNet",
    "Wattpad",
    "SpaceBattles",
    "SufficientVelocity",
    "QuestionableQuesting",
    "RoyalRoad",
    "WebNovel",
    "ScribbleHub",
    "NovelBin",
    "Other",
] as const satisfies readonly Source[];

export const LIBRARY_SORT_OPTIONS = [
    "title",
    "author",
    "status",
    "rating",
    "progress",
    "updatedAt",
    "createdAt",
    "wordCount",
    "chapterCount",
    "isNsfw",
] as const satisfies readonly ProgressSortBy[];

export const LIBRARY_STATUS_OPTIONS = [
    "NotStarted",
    "Reading",
    "Paused",
    "Completed",
    "Dropped",
    "PlanToRead",
    "DroppedAsAbandoned",
] as const satisfies readonly ProgressStatus[];

export const librarySearchParamsParsers = {
    q: parseAsString.withDefault("").withOptions({
        clearOnDefault: true,
        limitUrlUpdates: debounce(LIBRARY_SEARCH_DEBOUNCE_MS),
        shallow: false,
    }),
    source: parseAsStringEnum<Source | "all">(["all", ...LIBRARY_SOURCE_OPTIONS])
        .withDefault("all")
        .withOptions({
            clearOnDefault: true,
            shallow: false,
        }),
    sortBy: parseAsStringEnum<ProgressSortBy>([...LIBRARY_SORT_OPTIONS])
        .withDefault("updatedAt")
        .withOptions({
            clearOnDefault: true,
            shallow: false,
        }),
    sortOrder: parseAsStringEnum<SortOrder>(["asc", "desc"]).withDefault("desc").withOptions({
        clearOnDefault: true,
        shallow: false,
    }),
    status: parseAsStringEnum<ProgressStatus | "all">(["all", ...LIBRARY_STATUS_OPTIONS])
        .withDefault("all")
        .withOptions({
            clearOnDefault: true,
            shallow: false,
        }),
};

export type LibrarySearchParams = inferParserType<typeof librarySearchParamsParsers>;

export function createLibraryQueryInput(params: LibrarySearchParams) {
    const search = params.q.trim();

    return {
        limit: LIBRARY_PAGE_SIZE,
        search: search || undefined,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        source: params.source === "all" ? undefined : [params.source],
        status: params.status === "all" ? undefined : [params.status],
    };
}
