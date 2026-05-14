import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { backendCacheTags } from "#/server/backend/cache/tags";
import { db } from "#/server/db";
import { type ProgressSortBy, progresses, type progressStatusEnum } from "#/server/db/schema/progress";
import type { sourceEnum } from "#/server/db/schema/story";
import { getSortColumn, libraryMaterializedView, libraryStatsMaterializedView } from "#/server/db/schema/view";

export const MAX_SEARCH_LENGTH = 255;
const MIN_RATING = 0;
const MAX_RATING = 5;

export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export const PUBLIC_ID_MIN = 1;
export const PUBLIC_ID_MAX = 50;

type Database = typeof db;

export type ProgressQueryResult = {
    data: {
        progressPublicId: string;
        storyPublicId: string;
        storyTitle: string;
        storyAuthor: string;
        progressStatus: string;
        progressCurrentChapter: number;
        progressRating: number;
        storyStatus: string;
        updatedAt: Date;
        tags: { publicId: string; name: string }[];
        fandoms: { publicId: string; name: string }[];
        storySource?: string;
        storyUrl?: string;
        storyChapterCount?: number;
        storyWordCount?: number;
        storyIsNsfw?: boolean;
        storyDescription?: string;
        progressNotes?: string | null;
        createdAt?: Date;
        storyVersion: number;
        progressVersion: number;
    }[];
    meta: {
        hasNextPage: boolean;
        nextCursor?: string;
        searchTerm?: string;
    };
};

export type LibraryQueryInput = {
    limit: number;
    cursor?: string;
    search?: string;
    sortBy: ProgressSortBy;
    sortOrder: "asc" | "desc" | null;
    status?: (typeof progressStatusEnum.enumValues)[number][];
    source?: (typeof sourceEnum.enumValues)[number][];
    isNsfw?: boolean;
    minRating?: number;
    maxRating?: number;
    hasNotes?: boolean;
    completedOnly?: boolean;
    inProgressOnly?: boolean;
};

type CursorData = {
    type: "string" | "number" | "date" | "boolean";
    value: string | number | boolean;
    id: string;
};

function sanitizeSearchInput(search: string): string {
    return search
        .trim()
        .replace(/[^\w\s'-]/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, MAX_SEARCH_LENGTH);
}

function createCursor(sortBy: ProgressSortBy, sortValue: unknown, id: string): string {
    let cursorData: CursorData;

    switch (sortBy) {
        case "progress":
        case "rating":
        case "wordCount":
        case "chapterCount":
            cursorData = {
                type: "number",
                value: Number(sortValue) || 0,
                id,
            };
            break;
        case "updatedAt":
        case "createdAt":
            cursorData = {
                type: "date",
                value: sortValue instanceof Date ? sortValue.toISOString() : String(sortValue ?? ""),
                id,
            };
            break;
        case "isNsfw":
            cursorData = {
                type: "boolean",
                value: Boolean(sortValue),
                id,
            };
            break;
        default:
            cursorData = {
                type: "string",
                value: String(sortValue ?? ""),
                id,
            };
            break;
    }

    return Buffer.from(JSON.stringify(cursorData)).toString("base64");
}

function parseCursor(cursor: string | undefined): CursorData | null {
    if (!cursor) return null;

    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as unknown;

        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "type" in parsed &&
            "value" in parsed &&
            "id" in parsed &&
            typeof parsed.id === "string" &&
            (parsed.type === "string" ||
                parsed.type === "number" ||
                parsed.type === "date" ||
                parsed.type === "boolean")
        ) {
            return parsed as CursorData;
        }
        return null;
    } catch {
        return null;
    }
}

function createCursorPredicate(cursorData: CursorData, sortBy: ProgressSortBy, sortOrder: "asc" | "desc"): SQL {
    const sortColumn = getSortColumn(sortBy);
    const { type, value, id } = cursorData;

    let typedValue: SQL;
    switch (type) {
        case "number":
            typedValue = sql`${Number(value)}`;
            break;
        case "date":
            typedValue = sql`${new Date(String(value)).toISOString()}::timestamp`;
            break;
        case "boolean":
            typedValue = sql`${Boolean(value)}`;
            break;
        default:
            typedValue = sql`${String(value)}`;
            break;
    }

    const comparison = sortOrder === "asc" ? ">" : "<";

    return sql`(
        ${sortColumn} ${sql.raw(comparison)} ${typedValue}
        OR (
            ${sortColumn} = ${typedValue}
            AND ${libraryMaterializedView.progressPublicId} ${sql.raw(comparison)} ${id}
        )
    )`;
}

type BuildWhereConditionsInput = Omit<LibraryQueryInput, "limit" | "cursor" | "sortBy" | "sortOrder">;

function buildWhereConditions(
    input: BuildWhereConditionsInput,
    cursorData: CursorData | null,
    sortBy: ProgressSortBy,
    sortOrder: "asc" | "desc"
): SQL[] {
    const whereConditions: SQL[] = [];

    if (input.completedOnly && input.inProgressOnly) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "completedOnly and inProgressOnly cannot both be true",
        });
    }

    if (cursorData) {
        whereConditions.push(createCursorPredicate(cursorData, sortBy, sortOrder));
    }

    if (input.search && input.search.trim().length > 0) {
        const sanitizedSearch = sanitizeSearchInput(input.search);
        if (sanitizedSearch.length === 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid search query",
            });
        }

        const searchCondition = orSearchConditions(sanitizedSearch);
        if (searchCondition) {
            whereConditions.push(searchCondition);
        }
    }

    if (input.status && input.status.length > 0) {
        whereConditions.push(inArray(libraryMaterializedView.progressStatus, input.status));
    }

    if (input.source && input.source.length > 0) {
        whereConditions.push(inArray(libraryMaterializedView.storySource, input.source));
    }

    if (input.isNsfw !== undefined) {
        whereConditions.push(eq(libraryMaterializedView.storyIsNsfw, input.isNsfw));
    }

    if (input.minRating !== undefined) {
        const minRating = Math.max(MIN_RATING, Math.min(MAX_RATING, Number(input.minRating)));
        whereConditions.push(sql`${libraryMaterializedView.progressRating} >= ${minRating}`);
    }

    if (input.maxRating !== undefined) {
        const maxRating = Math.max(MIN_RATING, Math.min(MAX_RATING, Number(input.maxRating)));
        whereConditions.push(sql`${libraryMaterializedView.progressRating} <= ${maxRating}`);
    }

    if (input.hasNotes !== undefined) {
        whereConditions.push(
            input.hasNotes
                ? sql`${libraryMaterializedView.progressNotes} IS NOT NULL AND ${libraryMaterializedView.progressNotes} != ''`
                : sql`${libraryMaterializedView.progressNotes} IS NULL OR ${libraryMaterializedView.progressNotes} = ''`
        );
    }

    if (input.completedOnly) {
        whereConditions.push(eq(libraryMaterializedView.progressStatus, "Completed"));
    }

    if (input.inProgressOnly) {
        whereConditions.push(inArray(libraryMaterializedView.progressStatus, ["Reading", "Paused"]));
    }

    return whereConditions;
}

function orSearchConditions(sanitizedSearch: string) {
    return sql`(
        ${libraryMaterializedView.searchVector} @@ websearch_to_tsquery('english', ${sanitizedSearch})
        OR ${libraryMaterializedView.storyTitle} ILIKE ${`%${sanitizedSearch}%`}
        OR ${libraryMaterializedView.storyAuthor} ILIKE ${`%${sanitizedSearch}%`}
        OR ${libraryMaterializedView.progressNotes} ILIKE ${`%${sanitizedSearch}%`}
        OR similarity(lower(${libraryMaterializedView.storyTitle}), lower(${sanitizedSearch})) > 0.2
        OR similarity(lower(${libraryMaterializedView.storyAuthor}), lower(${sanitizedSearch})) > 0.2
    )`;
}

function generateNextCursor(items: Record<string, unknown>[], sortBy: ProgressSortBy): string | undefined {
    const lastItem = items.at(-1);
    if (!lastItem) return;

    let sortValue: unknown;
    switch (sortBy) {
        case "progress": {
            const storyChapterCount = Number(lastItem.storyChapterCount) || 0;
            const progressCurrentChapter = Number(lastItem.progressCurrentChapter) || 0;
            sortValue = storyChapterCount > 0 ? progressCurrentChapter / storyChapterCount : 0;
            break;
        }
        case "isNsfw":
            sortValue = Boolean(lastItem.storyIsNsfw);
            break;
        default:
            sortValue = lastItem[sortBy as keyof typeof lastItem];
            break;
    }

    return createCursor(sortBy, sortValue, String(lastItem.progressPublicId));
}

function createOrderByClause(sortBy: ProgressSortBy, sortOrder: "asc" | "desc", sanitizedSearch?: string): SQL[] {
    if (sanitizedSearch && (sortBy === "title" || sortBy === "author")) {
        const relevanceExpression = sql`
            CASE
                WHEN ${libraryMaterializedView.storyTitle} ILIKE ${sanitizedSearch} THEN 100
                WHEN ${libraryMaterializedView.storyTitle} ILIKE ${`${sanitizedSearch}%`} THEN 90
                WHEN ${libraryMaterializedView.storyAuthor} ILIKE ${sanitizedSearch} THEN 85
                WHEN ${libraryMaterializedView.storyTitle} ILIKE ${`%${sanitizedSearch}%`} THEN 80
                WHEN ${libraryMaterializedView.storyAuthor} ILIKE ${`%${sanitizedSearch}%`} THEN 75
                WHEN ${libraryMaterializedView.searchVector} @@ websearch_to_tsquery('english', ${sanitizedSearch}) THEN
                    60 + ts_rank(${libraryMaterializedView.searchVector}, websearch_to_tsquery('english', ${sanitizedSearch})) * 40
                WHEN ${libraryMaterializedView.storyTitle} % ${sanitizedSearch} THEN
                    50 + similarity(${libraryMaterializedView.storyTitle}, ${sanitizedSearch}) * 25
                WHEN ${libraryMaterializedView.storyAuthor} % ${sanitizedSearch} THEN
                    45 + similarity(${libraryMaterializedView.storyAuthor}, ${sanitizedSearch}) * 25
                WHEN ${libraryMaterializedView.progressNotes} ILIKE ${`%${sanitizedSearch}%`} THEN 30
                ELSE 0
            END
        `;
        const secondarySort = getSortColumn(sortBy);
        const tiebreaker =
            sortOrder === "asc"
                ? asc(libraryMaterializedView.progressPublicId)
                : desc(libraryMaterializedView.progressPublicId);

        return sortOrder === "asc"
            ? [desc(relevanceExpression), asc(secondarySort), tiebreaker]
            : [desc(relevanceExpression), desc(secondarySort), tiebreaker];
    }

    const sortColumn = getSortColumn(sortBy);
    const tiebreaker =
        sortOrder === "asc"
            ? asc(libraryMaterializedView.progressPublicId)
            : desc(libraryMaterializedView.progressPublicId);

    return sortOrder === "asc" ? [asc(sortColumn), tiebreaker] : [desc(sortColumn), tiebreaker];
}

export async function deleteProgress(database: Database, publicId: string) {
    const [deletedProgress] = await database.delete(progresses).where(eq(progresses.publicId, publicId)).returning({
        id: progresses.id,
        publicId: progresses.publicId,
    });

    if (!deletedProgress) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Progress not found",
        });
    }

    return deletedProgress;
}

export async function listLibraryProgress(database: Database, input: LibraryQueryInput): Promise<ProgressQueryResult> {
    const { limit, cursor, search, sortBy, sortOrder: inputSortOrder, ...filterInput } = input;
    const sortOrder = inputSortOrder ?? "asc";
    const effectiveLimit = Math.min(limit, MAX_LIMIT);

    const sanitizedSearch = search?.trim() ? sanitizeSearchInput(search) : undefined;
    if (sanitizedSearch && sanitizedSearch.length < 2) {
        return {
            data: [],
            meta: {
                hasNextPage: false,
                nextCursor: undefined,
                searchTerm: sanitizedSearch,
            },
        };
    }

    const cursorData = parseCursor(cursor);
    const whereConditions = buildWhereConditions(filterInput, cursorData, sortBy, sortOrder);
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    const hasValidSearch = Boolean(sanitizedSearch);

    const baseSelectFields = {
        progressPublicId: libraryMaterializedView.progressPublicId,
        storyPublicId: libraryMaterializedView.storyPublicId,
        storyTitle: libraryMaterializedView.storyTitle,
        storyAuthor: libraryMaterializedView.storyAuthor,
        progressStatus: libraryMaterializedView.progressStatus,
        progressCurrentChapter: libraryMaterializedView.progressCurrentChapter,
        progressRating: libraryMaterializedView.progressRating,
        storyStatus: libraryMaterializedView.storyStatus,
        updatedAt: libraryMaterializedView.updatedAt,
        storyIsNsfw: libraryMaterializedView.storyIsNsfw,
        tags: libraryMaterializedView.tags,
        fandoms: libraryMaterializedView.fandoms,
        storyVersion: libraryMaterializedView.storyVersion,
        progressVersion: libraryMaterializedView.progressVersion,
    };

    const selectFields = {
        ...baseSelectFields,
        ...((!hasValidSearch || sortBy === "updatedAt") && {
            storySource: libraryMaterializedView.storySource,
            storyUrl: libraryMaterializedView.storyUrl,
            storyChapterCount: libraryMaterializedView.storyChapterCount,
            storyWordCount: libraryMaterializedView.storyWordCount,
            storyDescription: libraryMaterializedView.storyDescription,
            progressNotes: libraryMaterializedView.progressNotes,
            createdAt: libraryMaterializedView.createdAt,
        }),
        ...(hasValidSearch && {
            relevanceScore: sql<number>`
                CASE
                    WHEN ${libraryMaterializedView.storyTitle} ILIKE ${sanitizedSearch} THEN 100
                    WHEN ${libraryMaterializedView.storyTitle} ILIKE ${`${sanitizedSearch}%`} THEN 90
                    WHEN ${libraryMaterializedView.storyAuthor} ILIKE ${sanitizedSearch} THEN 85
                    ELSE 50 + similarity(${libraryMaterializedView.storyTitle}, ${sanitizedSearch}) * 25
                END
            `.as("relevance_score"),
        }),
    };

    const results = await database
        .select(selectFields)
        .from(libraryMaterializedView)
        .where(whereClause)
        .orderBy(...createOrderByClause(sortBy, sortOrder, sanitizedSearch))
        .limit(effectiveLimit + 1);

    const hasNextPage = results.length > effectiveLimit;
    const items = hasNextPage ? results.slice(0, effectiveLimit) : results;
    const mappedItems = items.map((item) => ({
        ...item,
        tags: Array.isArray(item.tags) ? item.tags : [],
        fandoms: Array.isArray(item.fandoms) ? item.fandoms : [],
    }));
    const nextCursor = hasNextPage ? generateNextCursor(mappedItems, sortBy) : undefined;

    return {
        data: mappedItems,
        meta: {
            hasNextPage,
            nextCursor,
            ...(hasValidSearch && { searchTerm: sanitizedSearch }),
        },
    };
}

export async function refreshLibraryView(database: Database) {
    await database.refreshMaterializedView(libraryMaterializedView).concurrently();
}

export async function refreshLibraryStatsView(database: Database) {
    await database.refreshMaterializedView(libraryStatsMaterializedView).concurrently();
}

export async function refreshLibraryReadModels(database: Database) {
    await refreshLibraryView(database);
    await refreshLibraryStatsView(database);
}

export async function getLibraryStats() {
    "use cache";
    cacheTag(backendCacheTags.libraryStats);
    cacheLife("hours");

    const stats = await db.select().from(libraryStatsMaterializedView);
    return stats[0] || {};
}
