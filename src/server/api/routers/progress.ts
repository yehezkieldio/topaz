import { TRPCError } from "@trpc/server";
import { type SQL, and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import z from "zod/v4";
import { sortOrderEnum } from "#/lib/utils";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "#/server/api/trpc";
import { invalidateLibraryStats } from "#/server/cache/actions";
import { type ProgressSortBy, progressSortByEnum, progressStatusEnum, progresses } from "#/server/db/schema/progress";
import { sourceEnum } from "#/server/db/schema/story";
import { getSortColumn, libraryMaterializedView, libraryStatsMaterializedView } from "#/server/db/schema/view";

const MAX_SEARCH_LENGTH = 255;
const MIN_RATING = 0;
const MAX_RATING = 5;

const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const PUBLIC_ID_MIN = 1;
const PUBLIC_ID_MAX = 50;

export type ProgressQueryResult = {
    data: Array<{
        progressPublicId: string;
        storyPublicId: string;
        storyTitle: string;
        storyAuthor: string;
        progressStatus: string;
        progressCurrentChapter: number;
        progressRating: number;
        storyStatus: string;
        updatedAt: Date;
        tags: Array<{ publicId: string; name: string }>;
        fandoms: Array<{ publicId: string; name: string }>;
        storySource?: string;
        storyUrl?: string;
        storyChapterCount?: number;
        storyWordCount?: number;
        storyIsNsfw?: boolean;
        storyDescription?: string;
        progressNotes?: string | null;
        createdAt?: Date;
    }>;
    meta: {
        hasNextPage: boolean;
        nextCursor?: string;
        searchTerm?: string;
    };
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

    const sortByStr = String(sortBy);
    switch (sortByStr) {
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
    const typeStr = String(type);
    switch (typeStr) {
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
    const equalComparison = sortOrder === "asc" ? ">" : "<";

    return sql`(
        ${sortColumn} ${sql.raw(comparison)} ${typedValue}
        OR (
            ${sortColumn} = ${typedValue}
            AND ${libraryMaterializedView.progressPublicId} ${sql.raw(equalComparison)} ${id}
        )
    )`;
}

type BuildWhereConditionsInput = {
    search?: string;
    status?: string[];
    source?: string[];
    isNsfw?: boolean;
    minRating?: number;
    maxRating?: number;
    hasNotes?: boolean;
    completedOnly?: boolean;
    inProgressOnly?: boolean;
};

function buildWhereConditions(
    input: BuildWhereConditionsInput,
    cursorData: CursorData | null,
    sortBy: ProgressSortBy,
    sortOrder: "asc" | "desc",
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

        const searchCondition = or(
            sql`${libraryMaterializedView.searchVector} @@ websearch_to_tsquery('english', ${sanitizedSearch})`,
            ilike(libraryMaterializedView.storyTitle, `%${sanitizedSearch}%`),
            ilike(libraryMaterializedView.storyAuthor, `%${sanitizedSearch}%`),
            ilike(libraryMaterializedView.progressNotes, `%${sanitizedSearch}%`),
            sql`similarity(lower(${libraryMaterializedView.storyTitle}), lower(${sanitizedSearch})) > 0.2`,
            sql`similarity(lower(${libraryMaterializedView.storyAuthor}), lower(${sanitizedSearch})) > 0.2`,
        );
        if (searchCondition) {
            whereConditions.push(searchCondition);
        }
    }

    if (input.status && input.status.length > 0) {
        const validStatuses = input.status.filter((status) =>
            progressStatusEnum.enumValues.includes(status as (typeof progressStatusEnum.enumValues)[number]),
        );
        if (validStatuses.length > 0) {
            whereConditions.push(inArray(libraryMaterializedView.progressStatus, validStatuses));
        }
    }

    if (input.source && input.source.length > 0) {
        const validSources = input.source.filter((source) =>
            sourceEnum.enumValues.includes(source as (typeof sourceEnum.enumValues)[number]),
        );
        if (validSources.length > 0) {
            whereConditions.push(inArray(libraryMaterializedView.storySource, validSources));
        }
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
                : sql`${libraryMaterializedView.progressNotes} IS NULL OR ${libraryMaterializedView.progressNotes} = ''`,
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

function generateNextCursor(items: Record<string, unknown>[], sortBy: ProgressSortBy): string | undefined {
    if (items.length === 0) return;

    const lastItem = items.at(-1);
    if (!lastItem) return;

    let sortValue: unknown;
    switch (sortBy) {
        case "progress": {
            const storyChapterCount = Number(lastItem.storyChapterCount) || 0;
            const progressCurrentChapter = Number(lastItem.progressCurrentChapter) || 0;
            const progress = storyChapterCount > 0 ? progressCurrentChapter / storyChapterCount : 0;
            sortValue = progress;
            break;
        }
        case "isNsfw":
            sortValue = Boolean(lastItem.storyIsNsfw);
            break;
        default:
            sortValue = lastItem[sortBy as keyof typeof lastItem];
            break;
    }

    const id = String(lastItem.progressPublicId);
    return createCursor(sortBy, sortValue, id);
}

const progressQuerySchema = z
    .object({
        limit: z.number().min(MIN_LIMIT).max(MAX_LIMIT).default(DEFAULT_LIMIT),
        cursor: z.string().optional(),
        search: z.string().max(MAX_SEARCH_LENGTH).optional(),
        sortBy: progressSortByEnum.default("updatedAt"),
        sortOrder: sortOrderEnum.nullable().default("asc"),
        status: z.array(z.enum(progressStatusEnum.enumValues)).max(10).optional(),
        source: z.array(z.enum(sourceEnum.enumValues)).max(10).optional(),
        isNsfw: z.boolean().optional(),
        minRating: z.number().min(MIN_RATING).max(MAX_RATING).optional(),
        maxRating: z.number().min(MIN_RATING).max(MAX_RATING).optional(),
        hasNotes: z.boolean().optional(),
        completedOnly: z.boolean().optional(),
        inProgressOnly: z.boolean().optional(),
    })
    .refine((data) => !(data.completedOnly && data.inProgressOnly), {
        message: "completedOnly and inProgressOnly cannot both be true",
        path: ["completedOnly", "inProgressOnly"],
    })
    .refine(
        (data) => {
            if (data.minRating !== undefined && data.maxRating !== undefined) {
                return data.minRating <= data.maxRating;
            }
            return true;
        },
        {
            message: "minRating must be less than or equal to maxRating",
            path: ["minRating", "maxRating"],
        },
    );

export const progressRouter = createTRPCRouter({
    delete: protectedProcedure
        .input(
            z.object({
                publicId: z.string().min(PUBLIC_ID_MIN).max(PUBLIC_ID_MAX),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [deletedProgress] = await ctx.db
                .delete(progresses)
                .where(eq(progresses.publicId, input.publicId))
                .returning({
                    id: progresses.id,
                    publicId: progresses.publicId,
                });

            if (!deletedProgress) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Progress not found",
                });
            }

            await ctx.db.refreshMaterializedView(libraryMaterializedView).concurrently();
            await ctx.db.refreshMaterializedView(libraryStatsMaterializedView);

            await invalidateLibraryStats();

            return deletedProgress;
        }),
    all: publicProcedure.input(progressQuerySchema).query(async ({ ctx, input }): Promise<ProgressQueryResult> => {
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
                    ...(sanitizedSearch && { searchTerm: sanitizedSearch }),
                },
            };
        }

        const cursorData = parseCursor(cursor);
        const whereConditions = buildWhereConditions({ search, ...filterInput }, cursorData, sortBy, sortOrder);
        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        const hasValidSearch = sanitizedSearch && sanitizedSearch.length > 0;

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

        const baseQuery = ctx.db.select(selectFields).from(libraryMaterializedView).where(whereClause);

        let orderByClause: SQL[];
        if (hasValidSearch && (sortBy === "title" || sortBy === "author")) {
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

            orderByClause =
                sortOrder === "asc"
                    ? [desc(relevanceExpression), asc(secondarySort), tiebreaker]
                    : [desc(relevanceExpression), desc(secondarySort), tiebreaker];
        } else {
            const sortColumn = getSortColumn(sortBy);
            const tiebreaker =
                sortOrder === "asc"
                    ? asc(libraryMaterializedView.progressPublicId)
                    : desc(libraryMaterializedView.progressPublicId);

            orderByClause = sortOrder === "asc" ? [asc(sortColumn), tiebreaker] : [desc(sortColumn), tiebreaker];
        }

        const results = await baseQuery.orderBy(...orderByClause).limit(effectiveLimit + 1);

        const hasNextPage = results.length > effectiveLimit;
        const items = hasNextPage ? results.slice(0, effectiveLimit) : results;
        const mappedItems = items.map((item) => ({
            ...item,
            tags: Array.isArray(item.tags) ? item.tags : [],
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
    }),
});
