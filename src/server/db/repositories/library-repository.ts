import "server-only";

import { TRPCError } from "@trpc/server";
import { type AnyColumn, and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { normalizeSearchText } from "#/lib/utils";
import { backendCacheTags } from "#/server/backend/cache/tags";
import { db } from "#/server/db";
import { assignTaxonomyTermsToWork } from "#/server/db/repositories/taxonomy-repository";
import {
    type LibraryEntryStatus,
    type LibrarySortBy,
    libraryEntries,
    libraryEntryStatusEnum,
    librarySortByEnum,
    type ReadingEventType,
    readingEvents,
    readingStates,
} from "#/server/db/schema/library-entry";
import {
    type TaxonomyKind,
    taxonomyKindEnum,
    taxonomyKindSeeds,
    taxonomyKinds,
    taxonomyLabels,
    taxonomyTerms,
    workTaxonomyAssignments,
    workTaxonomyEffective,
} from "#/server/db/schema/taxonomy";
import {
    contributors,
    type Source,
    sourcePlatformSeeds,
    sourcePlatforms,
    type WorkStatus,
    workContributors,
    workSources,
    workStatusEnum,
    works,
} from "#/server/db/schema/work";

export const MAX_SEARCH_LENGTH = 255;
const MIN_RATING = 0;
const MAX_RATING = 5;
const LEADING_ARTICLE_REGEX = /^(the|a|an)\s+/;
const TRAILING_SLASH_REGEX = /\/+$/;

export const MIN_LIMIT = 1;
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export const PUBLIC_ID_MIN = 1;
export const PUBLIC_ID_MAX = 50;

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseOrTransaction = Database | Transaction;
type LibraryTaxonomyTerm = { kind: TaxonomyKind; publicId: string; name: string };

export type LibraryQueryResult = {
    data: {
        libraryEntryPublicId: string;
        workPublicId: string;
        workTitle: string;
        sourceAuthor: string;
        libraryEntryStatus: LibraryEntryStatus;
        currentChapter: number;
        rating: number;
        workStatus: WorkStatus;
        contributorNames: string[];
        updatedAt: Date;
        directTaxonomyTerms: LibraryTaxonomyTerm[];
        taxonomyTerms: LibraryTaxonomyTerm[];
        source: Source;
        sourceUrl?: string;
        sourceChapterCount?: number;
        sourceWordCount?: number;
        workIsNsfw?: boolean;
        workDescription?: string | null;
        readingNotes?: string | null;
        createdAt?: Date;
        workVersion: number;
        libraryEntryVersion: number;
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
    sortBy: LibrarySortBy;
    sortOrder: "asc" | "desc" | null;
    status?: (typeof libraryEntryStatusEnum.options)[number][];
    source?: Source[];
    isNsfw?: boolean;
    minRating?: number;
    maxRating?: number;
    hasNotes?: boolean;
    completedOnly?: boolean;
    inProgressOnly?: boolean;
    directTaxonomyTermIds?: string[];
    effectiveTaxonomyTermIds?: string[];
    favorite?: boolean;
    minWordCount?: number;
    maxWordCount?: number;
    minChapterCount?: number;
    maxChapterCount?: number;
};

export type CreateLibraryItemInput = {
    author: string;
    chapterCount?: number | null;
    contentRating?: string;
    currentChapter?: number;
    description?: string | null;
    externalId?: string | null;
    isNsfw: boolean;
    notes?: string | null;
    rating?: number | null;
    source: Source;
    status: LibraryEntryStatus;
    summary?: string | null;
    taxonomyTermPublicIds?: string[];
    title: string;
    url: string;
    userId: string;
    wordCount?: number | null;
    workStatus: WorkStatus;
};

export type UpdateLibraryItemInput = Omit<CreateLibraryItemInput, "userId"> & {
    libraryEntryPublicId: string;
    libraryEntryVersion?: number;
    workPublicId: string;
    workVersion?: number;
};

type CursorData = {
    id: string;
    sortBy: LibrarySortBy;
    sortOrder: "asc" | "desc";
    value: boolean | number | string | null;
};

const sourcePlatformKeyBySource: Record<Source, string> = {
    ArchiveOfOurOwn: "ao3",
    FanFictionNet: "fanfiction_net",
    NovelBin: "novel_bin",
    Other: "other",
    QuestionableQuesting: "questionable_questing",
    RoyalRoad: "royal_road",
    ScribbleHub: "scribble_hub",
    SpaceBattles: "spacebattles",
    SufficientVelocity: "sufficient_velocity",
    Wattpad: "wattpad",
    WebNovel: "webnovel",
};

const sourceBySourcePlatformKey: Record<string, Source> = {
    ao3: "ArchiveOfOurOwn",
    fanfiction_net: "FanFictionNet",
    novel_bin: "NovelBin",
    other: "Other",
    questionable_questing: "QuestionableQuesting",
    royal_road: "RoyalRoad",
    scribble_hub: "ScribbleHub",
    spacebattles: "SpaceBattles",
    sufficient_velocity: "SufficientVelocity",
    wattpad: "Wattpad",
    webnovel: "WebNovel",
};

function sanitizeSearchInput(search: string): string {
    return search
        .trim()
        .replace(/[^\w\s'-]/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, MAX_SEARCH_LENGTH);
}

function sortTitle(title: string): string {
    return normalizeSearchText(title).replace(LEADING_ARTICLE_REGEX, "");
}

function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.hash = "";
        parsed.hostname = parsed.hostname.toLowerCase();
        parsed.pathname = parsed.pathname.replace(TRAILING_SLASH_REGEX, "");
        return parsed.toString();
    } catch {
        return url.trim().toLowerCase();
    }
}

function createCursor(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString("base64");
}

function parseCursor(cursor: string | undefined): CursorData | null {
    if (!cursor) return null;

    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as unknown;
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            "id" in parsed &&
            "sortBy" in parsed &&
            "sortOrder" in parsed &&
            "value" in parsed &&
            typeof parsed.id === "string" &&
            typeof parsed.sortBy === "string" &&
            (parsed.sortOrder === "asc" || parsed.sortOrder === "desc")
        ) {
            const sortBy = librarySortByEnum.safeParse(parsed.sortBy);
            const value = parsed.value;
            if (
                !(
                    sortBy.success &&
                    (value === null ||
                        typeof value === "boolean" ||
                        typeof value === "number" ||
                        typeof value === "string")
                )
            ) {
                return null;
            }

            return {
                id: parsed.id,
                sortBy: sortBy.data,
                sortOrder: parsed.sortOrder,
                value,
            };
        }
    } catch {
        return null;
    }

    return null;
}

const SORT_COLUMNS_BY_SORT_BY = {
    author: workSources.author_on_source,
    chapterCount: workSources.chapter_count,
    createdAt: libraryEntries.created_at,
    isNsfw: works.is_nsfw,
    progress: readingStates.current_chapter,
    rating: readingStates.rating,
    status: libraryEntries.status,
    title: works.sort_title,
    updatedAt: libraryEntries.updated_at,
    wordCount: workSources.word_count,
} as const satisfies Record<LibrarySortBy, AnyColumn>;

function sortColumn(sortBy: LibrarySortBy) {
    return SORT_COLUMNS_BY_SORT_BY[sortBy];
}

function sortExpression(sortBy: LibrarySortBy): SQL {
    return sql`${sortColumn(sortBy)}`;
}

function createOrderByClause(sortBy: LibrarySortBy, sortOrder: "asc" | "desc"): SQL[] {
    const direction = sortOrder === "asc" ? asc : desc;
    const tiebreaker = direction(libraryEntries.publicId);

    return [direction(sortColumn(sortBy)), tiebreaker];
}

function isNullableSort(sortBy: LibrarySortBy): boolean {
    return ["author", "rating", "progress", "wordCount", "chapterCount"].includes(sortBy);
}

function createCursorCondition(cursor: CursorData, sortBy: LibrarySortBy, sortOrder: "asc" | "desc"): SQL | undefined {
    if (cursor.sortBy !== sortBy || cursor.sortOrder !== sortOrder) {
        return;
    }

    const expression = sortExpression(sortBy);
    const isNullable = isNullableSort(sortBy);
    const idDirection =
        sortOrder === "asc"
            ? sql`${libraryEntries.publicId} > ${cursor.id}`
            : sql`${libraryEntries.publicId} < ${cursor.id}`;

    if (cursor.value === null) {
        return sortOrder === "asc"
            ? sql`(${expression} IS NULL AND ${idDirection})`
            : sql`(${expression} IS NOT NULL OR (${expression} IS NULL AND ${idDirection}))`;
    }

    if (sortOrder === "asc") {
        return isNullable
            ? sql`(${expression} > ${cursor.value} OR ${expression} IS NULL OR (${expression} = ${cursor.value} AND ${libraryEntries.publicId} > ${cursor.id}))`
            : sql`(${expression} > ${cursor.value} OR (${expression} = ${cursor.value} AND ${libraryEntries.publicId} > ${cursor.id}))`;
    }

    return sql`(${expression} < ${cursor.value} OR (${expression} = ${cursor.value} AND ${libraryEntries.publicId} < ${cursor.id}))`;
}

function cursorValueForItem(
    item: {
        createdAt: Date | null;
        currentChapter: number | null;
        libraryEntryStatus: string;
        rating: number | null;
        sourceAuthor: string | null;
        sourceChapterCount: number | null;
        sourceWordCount: number | null;
        updatedAt: Date | null;
        workIsNsfw: boolean;
        workTitle: string;
    },
    sortBy: LibrarySortBy
): CursorData["value"] {
    switch (sortBy) {
        case "title":
            return sortTitle(item.workTitle);
        case "author":
            return item.sourceAuthor;
        case "status":
            return libraryEntryStatusEnum.parse(item.libraryEntryStatus);
        case "rating":
            return item.rating;
        case "progress":
            return item.currentChapter;
        case "createdAt":
            return item.createdAt?.toISOString() ?? null;
        case "wordCount":
            return item.sourceWordCount;
        case "chapterCount":
            return item.sourceChapterCount;
        case "isNsfw":
            return item.workIsNsfw;
        default:
            return item.updatedAt?.toISOString() ?? null;
    }
}

function buildWhereConditions(input: Omit<LibraryQueryInput, "limit" | "cursor" | "sortBy" | "sortOrder">): SQL[] {
    const whereConditions: SQL[] = [];

    if (input.completedOnly && input.inProgressOnly) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "completedOnly and inProgressOnly cannot both be true",
        });
    }

    if (input.search && input.search.trim().length > 0) {
        const sanitizedSearch = sanitizeSearchInput(input.search);
        if (sanitizedSearch.length === 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid search query" });
        }

        whereConditions.push(sql`(
            ${works.title} ILIKE ${`%${sanitizedSearch}%`}
            OR ${works.description} ILIKE ${`%${sanitizedSearch}%`}
            OR ${works.summary} ILIKE ${`%${sanitizedSearch}%`}
            OR ${workSources.title_on_source} ILIKE ${`%${sanitizedSearch}%`}
            OR ${workSources.author_on_source} ILIKE ${`%${sanitizedSearch}%`}
            OR ${contributors.name} ILIKE ${`%${sanitizedSearch}%`}
            OR ${readingStates.notes} ILIKE ${`%${sanitizedSearch}%`}
            OR EXISTS (
                SELECT 1
                FROM ${workTaxonomyEffective}
                INNER JOIN ${taxonomyTerms} ON ${taxonomyTerms.id} = ${workTaxonomyEffective.termId}
                INNER JOIN ${taxonomyLabels} ON ${taxonomyLabels.termId} = ${taxonomyTerms.id}
                WHERE ${workTaxonomyEffective.workId} = ${works.id}
                AND (
                    ${taxonomyLabels.label} ILIKE ${`%${sanitizedSearch}%`}
                    OR similarity(lower(${taxonomyLabels.label}), lower(${sanitizedSearch})) > 0.2
                )
            )
            OR similarity(lower(${works.title}), lower(${sanitizedSearch})) > 0.2
            OR similarity(lower(${workSources.title_on_source}), lower(${sanitizedSearch})) > 0.2
            OR similarity(lower(${contributors.name}), lower(${sanitizedSearch})) > 0.2
        )`);
    }

    if (input.status && input.status.length > 0) {
        whereConditions.push(inArray(libraryEntries.status, input.status));
    }

    if (input.source && input.source.length > 0) {
        whereConditions.push(
            inArray(
                sourcePlatforms.key,
                input.source.map((source) => sourcePlatformKeyBySource[source])
            )
        );
    }

    if (input.isNsfw !== undefined) {
        whereConditions.push(eq(works.is_nsfw, input.isNsfw));
    }

    if (input.favorite !== undefined) {
        whereConditions.push(eq(libraryEntries.favorite, input.favorite));
    }

    if (input.minRating !== undefined) {
        const minRating = Math.max(MIN_RATING, Math.min(MAX_RATING, Number(input.minRating)));
        whereConditions.push(sql`${readingStates.rating} >= ${minRating}`);
    }

    if (input.maxRating !== undefined) {
        const maxRating = Math.max(MIN_RATING, Math.min(MAX_RATING, Number(input.maxRating)));
        whereConditions.push(sql`${readingStates.rating} <= ${maxRating}`);
    }

    if (input.hasNotes !== undefined) {
        whereConditions.push(
            input.hasNotes
                ? sql`${readingStates.notes} IS NOT NULL AND ${readingStates.notes} != ''`
                : sql`${readingStates.notes} IS NULL OR ${readingStates.notes} = ''`
        );
    }

    if (input.minWordCount !== undefined) {
        whereConditions.push(sql`${workSources.word_count} >= ${Math.max(0, Number(input.minWordCount))}`);
    }

    if (input.maxWordCount !== undefined) {
        whereConditions.push(sql`${workSources.word_count} <= ${Math.max(0, Number(input.maxWordCount))}`);
    }

    if (input.minChapterCount !== undefined) {
        whereConditions.push(sql`${workSources.chapter_count} >= ${Math.max(0, Number(input.minChapterCount))}`);
    }

    if (input.maxChapterCount !== undefined) {
        whereConditions.push(sql`${workSources.chapter_count} <= ${Math.max(0, Number(input.maxChapterCount))}`);
    }

    if (input.directTaxonomyTermIds && input.directTaxonomyTermIds.length > 0) {
        whereConditions.push(sql`EXISTS (
            SELECT 1
            FROM ${workTaxonomyAssignments}
            INNER JOIN ${taxonomyTerms} ON ${taxonomyTerms.id} = ${workTaxonomyAssignments.termId}
            WHERE ${workTaxonomyAssignments.workId} = ${works.id}
            AND ${inArray(taxonomyTerms.publicId, input.directTaxonomyTermIds)}
        )`);
    }

    if (input.effectiveTaxonomyTermIds && input.effectiveTaxonomyTermIds.length > 0) {
        whereConditions.push(sql`EXISTS (
            SELECT 1
            FROM ${workTaxonomyEffective}
            INNER JOIN ${taxonomyTerms} ON ${taxonomyTerms.id} = ${workTaxonomyEffective.termId}
            WHERE ${workTaxonomyEffective.workId} = ${works.id}
            AND ${inArray(taxonomyTerms.publicId, input.effectiveTaxonomyTermIds)}
        )`);
    }

    if (input.completedOnly) {
        whereConditions.push(eq(libraryEntries.status, "Completed"));
    }

    if (input.inProgressOnly) {
        whereConditions.push(inArray(libraryEntries.status, ["Reading", "Paused"]));
    }

    return whereConditions;
}

export async function seedV2ReferenceData(database: Database) {
    await database
        .insert(sourcePlatforms)
        .values(
            sourcePlatformSeeds.map((seed) => ({
                base_url: seed.baseUrl,
                is_active: true,
                key: seed.key,
                name: seed.name,
            }))
        )
        .onConflictDoUpdate({
            set: {
                base_url: sql`excluded.base_url`,
                is_active: sql`excluded.is_active`,
                name: sql`excluded.name`,
            },
            target: sourcePlatforms.key,
        });

    await database
        .insert(taxonomyKinds)
        .values(
            taxonomyKindSeeds.map((seed) => ({
                allows_relations: true,
                is_assignable: true,
                key: seed.key,
                name: seed.name,
                sort_order: seed.sortOrder,
            }))
        )
        .onConflictDoUpdate({
            set: {
                allows_relations: sql`excluded.allows_relations`,
                is_assignable: sql`excluded.is_assignable`,
                name: sql`excluded.name`,
                sort_order: sql`excluded.sort_order`,
            },
            target: taxonomyKinds.key,
        });

    return { sourcePlatforms: sourcePlatformSeeds.length, taxonomyKinds: taxonomyKindSeeds.length };
}

async function getSourcePlatformId(database: DatabaseOrTransaction, source: Source) {
    const sourceKey = sourcePlatformKeyBySource[source];
    const [sourcePlatform] = await database
        .select({ id: sourcePlatforms.id })
        .from(sourcePlatforms)
        .where(eq(sourcePlatforms.key, sourceKey))
        .limit(1);

    if (!sourcePlatform) {
        throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Source platform seed is missing: ${sourceKey}`,
        });
    }

    return sourcePlatform.id;
}

async function assertSourceUrlAvailable(
    database: DatabaseOrTransaction,
    input: {
        normalizedUrl: string;
        sourcePlatformId: string;
        workIdToExclude?: string;
    }
) {
    const conditions = [
        eq(workSources.sourcePlatformId, input.sourcePlatformId),
        eq(workSources.normalized_url, input.normalizedUrl),
    ];

    if (input.workIdToExclude) {
        conditions.push(sql`${workSources.workId} != ${input.workIdToExclude}`);
    }

    const [existingSource] = await database
        .select({ publicId: workSources.publicId })
        .from(workSources)
        .where(and(...conditions))
        .limit(1);

    if (existingSource) {
        throw new TRPCError({
            code: "CONFLICT",
            message: "A library work already uses this source URL.",
        });
    }
}

export async function createOrLinkContributor(
    database: DatabaseOrTransaction,
    input: { name: string; replaceExistingRole?: boolean; role?: string; workId: string }
) {
    const name = input.name.trim();
    if (!name) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Contributor name is required" });
    }

    const normalizedName = normalizeSearchText(name);
    const role = input.role ?? "author";
    const [existingContributor] = await database
        .select({ id: contributors.id, publicId: contributors.publicId })
        .from(contributors)
        .where(eq(contributors.sort_name, normalizedName))
        .limit(1);

    const contributor =
        existingContributor ??
        (
            await database
                .insert(contributors)
                .values({ name, sort_name: normalizedName })
                .returning({ id: contributors.id, publicId: contributors.publicId })
        )[0];

    if (!contributor) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create contributor" });
    }

    if (input.replaceExistingRole) {
        await database
            .delete(workContributors)
            .where(and(eq(workContributors.workId, input.workId), eq(workContributors.role, role)));
    }

    await database
        .insert(workContributors)
        .values({
            contributorId: contributor.id,
            display_order: 0,
            role,
            workId: input.workId,
        })
        .onConflictDoNothing();

    return contributor;
}

export async function createLibraryItem(database: Database, input: CreateLibraryItemInput) {
    return await database.transaction(async (tx) => {
        const sourcePlatformId = await getSourcePlatformId(tx, input.source);
        const normalizedUrl = normalizeUrl(input.url);
        await assertSourceUrlAvailable(tx, { normalizedUrl, sourcePlatformId });

        const [newWork] = await tx
            .insert(works)
            .values({
                content_rating: input.contentRating ?? "unknown",
                description: input.description ?? null,
                is_nsfw: input.isNsfw,
                publication_status: input.workStatus,
                sort_title: sortTitle(input.title),
                summary: input.summary ?? null,
                title: input.title.trim(),
            })
            .returning({ id: works.id, publicId: works.publicId });

        if (!newWork) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create work" });
        }

        await tx.insert(workSources).values({
            author_on_source: input.author,
            chapter_count: input.chapterCount ?? null,
            external_id: input.externalId ?? null,
            is_primary: true,
            normalized_url: normalizedUrl,
            source_status: input.workStatus,
            sourcePlatformId,
            title_on_source: input.title,
            url: input.url,
            word_count: input.wordCount ?? null,
            workId: newWork.id,
        });

        await createOrLinkContributor(tx, { name: input.author, workId: newWork.id });

        const [newLibraryEntry] = await tx
            .insert(libraryEntries)
            .values({
                status: input.status,
                userId: input.userId,
                workId: newWork.id,
            })
            .returning({ id: libraryEntries.id, publicId: libraryEntries.publicId });

        if (!newLibraryEntry) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create library entry" });
        }

        const [newReadingState] = await tx
            .insert(readingStates)
            .values({
                current_chapter: input.currentChapter ?? 0,
                libraryEntryId: newLibraryEntry.id,
                notes: input.notes ?? null,
                rating: input.rating ?? null,
            })
            .returning({ id: readingStates.id, publicId: readingStates.publicId });

        if (!newReadingState) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create reading state" });
        }

        await tx.insert(readingEvents).values({
            event_type: "added" satisfies ReadingEventType,
            libraryEntryId: newLibraryEntry.id,
            metadata: {},
            note: input.notes ?? null,
            to_chapter: input.currentChapter ?? 0,
            to_rating: input.rating ?? null,
            to_status: input.status,
        });

        await assignTaxonomyTermsToWork(tx, {
            termPublicIds: input.taxonomyTermPublicIds ?? [],
            workId: newWork.id,
        });

        return {
            libraryEntry: newLibraryEntry,
            readingState: newReadingState,
            work: newWork,
        };
    });
}

export async function updateLibraryItem(database: Database, input: UpdateLibraryItemInput) {
    return await database.transaction(async (tx) => {
        const [existing] = await tx
            .select({
                libraryEntryId: libraryEntries.id,
                previousChapter: readingStates.current_chapter,
                previousNotes: readingStates.notes,
                previousRating: readingStates.rating,
                previousStatus: libraryEntries.status,
                workId: works.id,
            })
            .from(libraryEntries)
            .innerJoin(works, eq(works.id, libraryEntries.workId))
            .leftJoin(readingStates, eq(readingStates.libraryEntryId, libraryEntries.id))
            .where(and(eq(works.publicId, input.workPublicId), eq(libraryEntries.publicId, input.libraryEntryPublicId)))
            .limit(1);

        if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Library entry not found" });
        }

        if (input.workVersion !== undefined) {
            const [versionMatch] = await tx
                .select({ id: works.id })
                .from(works)
                .where(and(eq(works.id, existing.workId), eq(works.version, input.workVersion)))
                .limit(1);
            if (!versionMatch) {
                throw new TRPCError({ code: "CONFLICT", message: "The work has been modified. Please refresh." });
            }
        }

        if (input.libraryEntryVersion !== undefined) {
            const [versionMatch] = await tx
                .select({ id: libraryEntries.id })
                .from(libraryEntries)
                .where(
                    and(
                        eq(libraryEntries.id, existing.libraryEntryId),
                        eq(libraryEntries.version, input.libraryEntryVersion)
                    )
                )
                .limit(1);
            if (!versionMatch) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "The library entry has been modified. Please refresh.",
                });
            }
        }

        await tx
            .update(works)
            .set({
                content_rating: input.contentRating ?? "unknown",
                description: input.description ?? null,
                is_nsfw: input.isNsfw,
                publication_status: input.workStatus,
                sort_title: sortTitle(input.title),
                summary: input.summary ?? null,
                title: input.title.trim(),
                version: sql`${works.version} + 1`,
            })
            .where(eq(works.id, existing.workId));

        const sourcePlatformId = await getSourcePlatformId(tx, input.source);
        const normalizedUrl = normalizeUrl(input.url);
        await assertSourceUrlAvailable(tx, {
            normalizedUrl,
            sourcePlatformId,
            workIdToExclude: existing.workId,
        });

        await tx
            .update(workSources)
            .set({
                author_on_source: input.author,
                chapter_count: input.chapterCount ?? null,
                external_id: input.externalId ?? null,
                normalized_url: normalizedUrl,
                source_status: input.workStatus,
                sourcePlatformId,
                title_on_source: input.title,
                url: input.url,
                word_count: input.wordCount ?? null,
            })
            .where(and(eq(workSources.workId, existing.workId), eq(workSources.is_primary, true)));

        await createOrLinkContributor(tx, { name: input.author, replaceExistingRole: true, workId: existing.workId });

        await tx
            .update(libraryEntries)
            .set({
                status: input.status,
                version: sql`${libraryEntries.version} + 1`,
            })
            .where(eq(libraryEntries.id, existing.libraryEntryId));

        await tx
            .update(readingStates)
            .set({
                current_chapter: input.currentChapter ?? 0,
                notes: input.notes ?? null,
                rating: input.rating ?? null,
                version: sql`${readingStates.version} + 1`,
            })
            .where(eq(readingStates.libraryEntryId, existing.libraryEntryId));

        const eventType =
            existing.previousStatus === input.status
                ? existing.previousRating === (input.rating ?? null)
                    ? existing.previousNotes === (input.notes ?? null)
                        ? "progressed"
                        : "note_changed"
                    : "rating_changed"
                : input.status === "Completed"
                  ? "completed"
                  : input.status === "Dropped" || input.status === "DroppedAsAbandoned"
                    ? "dropped"
                    : input.status === "Paused"
                      ? "paused"
                      : input.status === "Reading"
                        ? "resumed"
                        : "progressed";

        if (
            existing.previousStatus !== input.status ||
            existing.previousChapter !== (input.currentChapter ?? 0) ||
            existing.previousRating !== (input.rating ?? null) ||
            existing.previousNotes !== (input.notes ?? null)
        ) {
            await tx.insert(readingEvents).values({
                event_type: eventType satisfies ReadingEventType,
                from_chapter: existing.previousChapter,
                from_rating: existing.previousRating,
                from_status: existing.previousStatus,
                libraryEntryId: existing.libraryEntryId,
                metadata: {},
                note: input.notes ?? null,
                to_chapter: input.currentChapter ?? 0,
                to_rating: input.rating ?? null,
                to_status: input.status,
            });
        }

        await assignTaxonomyTermsToWork(tx, {
            termPublicIds: input.taxonomyTermPublicIds ?? [],
            workId: existing.workId,
        });

        return { libraryEntryPublicId: input.libraryEntryPublicId, workPublicId: input.workPublicId };
    });
}

export async function deleteWork(database: Database, publicId: string) {
    const [deletedWork] = await database
        .delete(works)
        .where(eq(works.publicId, publicId))
        .returning({ id: works.id, publicId: works.publicId });

    if (!deletedWork) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Work not found" });
    }

    return deletedWork;
}

export async function listLibraryEntries(database: Database, input: LibraryQueryInput): Promise<LibraryQueryResult> {
    const { limit, cursor, search, sortBy, sortOrder: inputSortOrder, ...filterInput } = input;
    const sortOrder = inputSortOrder ?? "asc";
    const effectiveLimit = Math.min(limit, MAX_LIMIT);
    const cursorData = parseCursor(cursor);
    const sanitizedSearch = search?.trim() ? sanitizeSearchInput(search) : undefined;

    if (sanitizedSearch && sanitizedSearch.length < 2) {
        return {
            data: [],
            meta: { hasNextPage: false, searchTerm: sanitizedSearch },
        };
    }

    const whereConditions = buildWhereConditions({ ...filterInput, search: sanitizedSearch });
    const cursorCondition = cursorData ? createCursorCondition(cursorData, sortBy, sortOrder) : undefined;
    if (cursorCondition) {
        whereConditions.push(cursorCondition);
    }
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const rows = await database
        .select({
            contributorNames: sql<
                string[]
            >`COALESCE(array_remove(array_agg(DISTINCT ${contributors.name}), NULL), ARRAY[]::text[])`,
            createdAt: libraryEntries.created_at,
            currentChapter: readingStates.current_chapter,
            libraryEntryPublicId: libraryEntries.publicId,
            libraryEntryStatus: libraryEntries.status,
            libraryEntryVersion: libraryEntries.version,
            rating: readingStates.rating,
            readingNotes: readingStates.notes,
            sourceAuthor: workSources.author_on_source,
            sourceChapterCount: workSources.chapter_count,
            sourcePlatformKey: sourcePlatforms.key,
            sourceUrl: workSources.url,
            sourceWordCount: workSources.word_count,
            updatedAt: libraryEntries.updated_at,
            workDescription: works.description,
            workIsNsfw: works.is_nsfw,
            workPublicId: works.publicId,
            workStatus: works.publication_status,
            workTitle: works.title,
            workVersion: works.version,
        })
        .from(libraryEntries)
        .innerJoin(works, eq(works.id, libraryEntries.workId))
        .leftJoin(readingStates, eq(readingStates.libraryEntryId, libraryEntries.id))
        .leftJoin(workSources, and(eq(workSources.workId, works.id), eq(workSources.is_primary, true)))
        .leftJoin(sourcePlatforms, eq(sourcePlatforms.id, workSources.sourcePlatformId))
        .leftJoin(workContributors, eq(workContributors.workId, works.id))
        .leftJoin(contributors, eq(contributors.id, workContributors.contributorId))
        .where(whereClause)
        .groupBy(
            libraryEntries.publicId,
            works.publicId,
            works.title,
            workSources.author_on_source,
            libraryEntries.status,
            readingStates.current_chapter,
            readingStates.rating,
            works.publication_status,
            libraryEntries.updated_at,
            sourcePlatforms.key,
            workSources.url,
            workSources.chapter_count,
            workSources.word_count,
            works.is_nsfw,
            works.description,
            readingStates.notes,
            libraryEntries.created_at,
            works.version,
            libraryEntries.version
        )
        .orderBy(...createOrderByClause(sortBy, sortOrder))
        .limit(effectiveLimit + 1);

    const hasNextPage = rows.length > effectiveLimit;
    const items = hasNextPage ? rows.slice(0, effectiveLimit) : rows;
    const workPublicIds = items.map((item) => item.workPublicId);
    const [taxonomyRows, directTaxonomyRows] =
        workPublicIds.length > 0
            ? await Promise.all([
                  database
                      .select({
                          kind: taxonomyKinds.key,
                          name: taxonomyTerms.name,
                          publicId: taxonomyTerms.publicId,
                          workPublicId: works.publicId,
                      })
                      .from(workTaxonomyEffective)
                      .innerJoin(works, eq(works.id, workTaxonomyEffective.workId))
                      .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, workTaxonomyEffective.termId))
                      .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
                      .where(inArray(works.publicId, workPublicIds)),
                  database
                      .select({
                          kind: taxonomyKinds.key,
                          name: taxonomyTerms.name,
                          publicId: taxonomyTerms.publicId,
                          workPublicId: works.publicId,
                      })
                      .from(workTaxonomyAssignments)
                      .innerJoin(works, eq(works.id, workTaxonomyAssignments.workId))
                      .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, workTaxonomyAssignments.termId))
                      .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
                      .where(inArray(works.publicId, workPublicIds)),
              ])
            : [[], []];

    const taxonomyByWork = new Map<string, LibraryTaxonomyTerm[]>();
    for (const taxonomyRow of taxonomyRows) {
        const terms = taxonomyByWork.get(taxonomyRow.workPublicId) ?? [];
        terms.push({
            kind: taxonomyKindEnum.parse(taxonomyRow.kind),
            name: taxonomyRow.name,
            publicId: taxonomyRow.publicId,
        });
        taxonomyByWork.set(taxonomyRow.workPublicId, terms);
    }

    const directTaxonomyByWork = new Map<string, LibraryTaxonomyTerm[]>();
    for (const taxonomyRow of directTaxonomyRows) {
        const terms = directTaxonomyByWork.get(taxonomyRow.workPublicId) ?? [];
        terms.push({
            kind: taxonomyKindEnum.parse(taxonomyRow.kind),
            name: taxonomyRow.name,
            publicId: taxonomyRow.publicId,
        });
        directTaxonomyByWork.set(taxonomyRow.workPublicId, terms);
    }

    const lastItem = items.at(-1);

    return {
        data: items.map((item) => ({
            contributorNames: item.contributorNames,
            createdAt: item.createdAt ?? undefined,
            currentChapter: item.currentChapter ?? 0,
            directTaxonomyTerms: directTaxonomyByWork.get(item.workPublicId) ?? [],
            libraryEntryPublicId: item.libraryEntryPublicId,
            libraryEntryStatus: libraryEntryStatusEnum.parse(item.libraryEntryStatus),
            libraryEntryVersion: item.libraryEntryVersion,
            rating: item.rating ?? 0,
            readingNotes: item.readingNotes,
            source: sourceBySourcePlatformKey[item.sourcePlatformKey ?? "other"] ?? "Other",
            sourceAuthor: item.sourceAuthor ?? item.contributorNames.at(0) ?? "Unknown",
            sourceChapterCount: item.sourceChapterCount ?? undefined,
            sourceUrl: item.sourceUrl ?? undefined,
            sourceWordCount: item.sourceWordCount ?? undefined,
            taxonomyTerms: taxonomyByWork.get(item.workPublicId) ?? [],
            updatedAt: item.updatedAt ?? new Date(0),
            workDescription: item.workDescription,
            workIsNsfw: item.workIsNsfw,
            workPublicId: item.workPublicId,
            workStatus: workStatusEnum.parse(item.workStatus),
            workTitle: item.workTitle,
            workVersion: item.workVersion,
        })),
        meta: {
            hasNextPage,
            nextCursor:
                hasNextPage && lastItem
                    ? createCursor({
                          id: lastItem.libraryEntryPublicId,
                          sortBy,
                          sortOrder,
                          value: cursorValueForItem(lastItem, sortBy),
                      })
                    : undefined,
            ...(sanitizedSearch && { searchTerm: sanitizedSearch }),
        },
    };
}

export async function getLibraryStats() {
    "use cache";
    cacheTag(backendCacheTags.libraryStats);
    cacheLife("hours");

    const [stats, taxonomyStats] = await Promise.all([
        db
            .select({
                averageRating: sql<number>`COALESCE(AVG(${readingStates.rating}), 0)`,
                completed: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Completed' THEN 1 END)`,
                dropped: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Dropped' THEN 1 END)`,
                paused: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Paused' THEN 1 END)`,
                reading: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Reading' THEN 1 END)`,
                totalChaptersRead: sql<number>`COALESCE(SUM(${readingStates.current_chapter}), 0)`,
                totalWordsRead: sql<number>`COALESCE(SUM(${workSources.word_count}), 0)`,
                workCount: sql<number>`COUNT(DISTINCT ${works.id})`,
            })
            .from(libraryEntries)
            .innerJoin(works, eq(works.id, libraryEntries.workId))
            .leftJoin(readingStates, eq(readingStates.libraryEntryId, libraryEntries.id))
            .leftJoin(workSources, and(eq(workSources.workId, works.id), eq(workSources.is_primary, true))),
        db
            .select({
                taxonomyTermCount: sql<number>`COUNT(DISTINCT ${workTaxonomyEffective.termId})`,
            })
            .from(workTaxonomyEffective),
    ]);

    return {
        ...(stats ?? {}),
        taxonomyTermCount: taxonomyStats.at(0)?.taxonomyTermCount ?? 0,
    };
}
