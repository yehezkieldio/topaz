import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { backendCacheTags } from "#/server/backend/cache/tags";
import { db } from "#/server/db";
import {
    libraryEntries,
    type ProgressSortBy,
    type progressStatusEnum,
    type ReadingEventType,
    readingEvents,
    readingStates,
} from "#/server/db/schema/progress";
import {
    contributors,
    type Source,
    sourcePlatforms,
    workContributors,
    workSources,
    works,
} from "#/server/db/schema/story";
import {
    taxonomyKinds,
    taxonomyLabels,
    taxonomyRelations,
    taxonomyTerms,
    workTaxonomyAssignments,
    workTaxonomyEffective,
} from "#/server/db/schema/taxonomy";

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
        taxonomyTerms: { kind: string; publicId: string; name: string }[];
        storySource?: string;
        storyUrl?: string;
        storyChapterCount?: number;
        storyWordCount?: number;
        storyIsNsfw?: boolean;
        storyDescription?: string | null;
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
    status?: (typeof progressStatusEnum.options)[number][];
    source?: Source[];
    isNsfw?: boolean;
    minRating?: number;
    maxRating?: number;
    hasNotes?: boolean;
    completedOnly?: boolean;
    inProgressOnly?: boolean;
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
    status: string;
    summary?: string | null;
    taxonomyTermPublicIds?: string[];
    title: string;
    url: string;
    userId: string;
    wordCount?: number | null;
    workStatus: string;
};

export type UpdateLibraryItemInput = Omit<CreateLibraryItemInput, "userId"> & {
    libraryEntryPublicId: string;
    libraryEntryVersion?: number;
    workPublicId: string;
    workVersion?: number;
};

type CursorData = {
    id: string;
};

const sourceKeyByLegacySource: Record<Source, string> = {
    ArchiveOfOurOwn: "ao3",
    FanFictionNet: "fanfiction_net",
    Wattpad: "wattpad",
    SpaceBattles: "spacebattles",
    SufficientVelocity: "sufficient_velocity",
    QuestionableQuesting: "questionable_questing",
    RoyalRoad: "royal_road",
    WebNovel: "webnovel",
    ScribbleHub: "scribble_hub",
    NovelBin: "novel_bin",
    Other: "other",
};

const legacySourceBySourceKey: Record<string, Source> = {
    ao3: "ArchiveOfOurOwn",
    fanfiction_net: "FanFictionNet",
    wattpad: "Wattpad",
    spacebattles: "SpaceBattles",
    sufficient_velocity: "SufficientVelocity",
    questionable_questing: "QuestionableQuesting",
    royal_road: "RoyalRoad",
    webnovel: "WebNovel",
    scribble_hub: "ScribbleHub",
    novel_bin: "NovelBin",
    other: "Other",
};

function sanitizeSearchInput(search: string): string {
    return search
        .trim()
        .replace(/[^\w\s'-]/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, MAX_SEARCH_LENGTH);
}

function normalizeText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sortTitle(title: string): string {
    return normalizeText(title).replace(LEADING_ARTICLE_REGEX, "");
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

function createCursor(id: string): string {
    return Buffer.from(JSON.stringify({ id } satisfies CursorData)).toString("base64");
}

function parseCursor(cursor: string | undefined): CursorData | null {
    if (!cursor) return null;

    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as unknown;
        if (typeof parsed === "object" && parsed !== null && "id" in parsed && typeof parsed.id === "string") {
            return { id: parsed.id };
        }
    } catch {
        return null;
    }

    return null;
}

function createOrderByClause(sortBy: ProgressSortBy, sortOrder: "asc" | "desc"): SQL[] {
    const direction = sortOrder === "asc" ? asc : desc;
    const tiebreaker = direction(libraryEntries.publicId);

    switch (sortBy) {
        case "title":
            return [direction(works.sort_title), tiebreaker];
        case "author":
            return [direction(workSources.author_on_source), tiebreaker];
        case "status":
            return [direction(libraryEntries.status), tiebreaker];
        case "rating":
            return [direction(readingStates.rating), tiebreaker];
        case "progress":
            return [direction(readingStates.current_chapter), tiebreaker];
        case "createdAt":
            return [direction(libraryEntries.created_at), tiebreaker];
        case "wordCount":
            return [direction(workSources.word_count), tiebreaker];
        case "chapterCount":
            return [direction(workSources.chapter_count), tiebreaker];
        case "isNsfw":
            return [direction(works.is_nsfw), tiebreaker];
        default:
            return [direction(libraryEntries.updated_at), tiebreaker];
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
            OR ${workSources.author_on_source} ILIKE ${`%${sanitizedSearch}%`}
            OR ${readingStates.notes} ILIKE ${`%${sanitizedSearch}%`}
            OR ${taxonomyLabels.label} ILIKE ${`%${sanitizedSearch}%`}
        )`);
    }

    if (input.status && input.status.length > 0) {
        whereConditions.push(inArray(libraryEntries.status, input.status));
    }

    if (input.source && input.source.length > 0) {
        whereConditions.push(
            inArray(
                sourcePlatforms.key,
                input.source.map((source) => sourceKeyByLegacySource[source])
            )
        );
    }

    if (input.isNsfw !== undefined) {
        whereConditions.push(eq(works.is_nsfw, input.isNsfw));
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

    if (input.completedOnly) {
        whereConditions.push(eq(libraryEntries.status, "Completed"));
    }

    if (input.inProgressOnly) {
        whereConditions.push(inArray(libraryEntries.status, ["Reading", "Paused"]));
    }

    return whereConditions;
}

async function getSourcePlatformId(database: DatabaseOrTransaction, source: Source) {
    const sourceKey = sourceKeyByLegacySource[source];
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

export async function rebuildEffectiveTaxonomyForWork(database: DatabaseOrTransaction, workId: string, maxDepth = 4) {
    const directAssignments = await database
        .select({ termId: workTaxonomyAssignments.termId })
        .from(workTaxonomyAssignments)
        .where(eq(workTaxonomyAssignments.workId, workId));

    await database.delete(workTaxonomyEffective).where(eq(workTaxonomyEffective.workId, workId));

    type EffectiveRow = {
        depth: number;
        reason: "direct" | "broader" | "implies" | "equivalent_to";
        sourceTermId: string | null;
        termId: string;
        workId: string;
    };

    const effectiveRows = new Map<string, EffectiveRow>();
    const queue: EffectiveRow[] = directAssignments.map((assignment) => ({
        workId,
        termId: assignment.termId,
        sourceTermId: assignment.termId,
        reason: "direct",
        depth: 0,
    }));

    while (queue.length > 0) {
        const row = queue.shift();
        if (!row || effectiveRows.has(row.termId)) continue;

        effectiveRows.set(row.termId, row);
        if (row.depth >= maxDepth) continue;

        const relations = await database
            .select({
                toTermId: taxonomyRelations.toTermId,
                relationType: taxonomyRelations.relation_type,
            })
            .from(taxonomyRelations)
            .where(
                and(
                    eq(taxonomyRelations.fromTermId, row.termId),
                    inArray(taxonomyRelations.relation_type, ["implies", "broader", "equivalent_to"])
                )
            );

        for (const relation of relations) {
            if (effectiveRows.has(relation.toTermId)) continue;
            queue.push({
                workId,
                termId: relation.toTermId,
                sourceTermId: row.termId,
                reason: relation.relationType as "broader" | "implies" | "equivalent_to",
                depth: row.depth + 1,
            });
        }
    }

    const rows = [...effectiveRows.values()];
    if (rows.length > 0) {
        await database
            .insert(workTaxonomyEffective)
            .values(rows)
            .onConflictDoNothing({ target: [workTaxonomyEffective.workId, workTaxonomyEffective.termId] });
    }

    return rows;
}

export async function assignTaxonomyTermsToWork(
    database: DatabaseOrTransaction,
    input: { termPublicIds: string[]; workId: string }
) {
    const uniquePublicIds = [...new Set(input.termPublicIds)];
    await database.delete(workTaxonomyAssignments).where(eq(workTaxonomyAssignments.workId, input.workId));

    if (uniquePublicIds.length === 0) {
        await rebuildEffectiveTaxonomyForWork(database, input.workId);
        return [];
    }

    const termRows = await database
        .select({ id: taxonomyTerms.id, publicId: taxonomyTerms.publicId })
        .from(taxonomyTerms)
        .where(inArray(taxonomyTerms.publicId, uniquePublicIds));

    if (termRows.length !== uniquePublicIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "One or more taxonomy terms were not found" });
    }

    await database.insert(workTaxonomyAssignments).values(
        termRows.map((term) => ({
            workId: input.workId,
            termId: term.id,
        }))
    );
    await rebuildEffectiveTaxonomyForWork(database, input.workId);

    return termRows;
}

export async function createOrLinkContributor(
    database: DatabaseOrTransaction,
    input: { name: string; role?: string; workId: string }
) {
    const name = input.name.trim() || "Unknown";
    const normalizedName = normalizeText(name);
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

    await database
        .insert(workContributors)
        .values({
            workId: input.workId,
            contributorId: contributor.id,
            role: input.role ?? "author",
            display_order: 0,
        })
        .onConflictDoNothing();

    return contributor;
}

export async function createLibraryItem(database: Database, input: CreateLibraryItemInput) {
    return await database.transaction(async (tx) => {
        const sourcePlatformId = await getSourcePlatformId(tx, input.source);
        const [newWork] = await tx
            .insert(works)
            .values({
                title: input.title.trim(),
                sort_title: sortTitle(input.title),
                description: input.description ?? null,
                summary: input.summary ?? null,
                publication_status: input.workStatus,
                content_rating: input.contentRating ?? "unknown",
                is_nsfw: input.isNsfw,
            })
            .returning({ id: works.id, publicId: works.publicId });

        if (!newWork) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create work" });
        }

        await tx.insert(workSources).values({
            workId: newWork.id,
            sourcePlatformId,
            url: input.url,
            normalized_url: normalizeUrl(input.url),
            external_id: input.externalId ?? null,
            title_on_source: input.title,
            author_on_source: input.author,
            chapter_count: input.chapterCount ?? null,
            word_count: input.wordCount ?? null,
            source_status: input.workStatus,
            is_primary: true,
        });

        await createOrLinkContributor(tx, { workId: newWork.id, name: input.author });

        const [newLibraryEntry] = await tx
            .insert(libraryEntries)
            .values({
                userId: input.userId,
                workId: newWork.id,
                status: input.status,
            })
            .returning({ id: libraryEntries.id, publicId: libraryEntries.publicId });

        if (!newLibraryEntry) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create library entry" });
        }

        const [newReadingState] = await tx
            .insert(readingStates)
            .values({
                libraryEntryId: newLibraryEntry.id,
                current_chapter: input.currentChapter ?? 0,
                rating: input.rating ?? null,
                notes: input.notes ?? null,
            })
            .returning({ id: readingStates.id, publicId: readingStates.publicId });

        if (!newReadingState) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create reading state" });
        }

        await tx.insert(readingEvents).values({
            libraryEntryId: newLibraryEntry.id,
            event_type: "added" satisfies ReadingEventType,
            to_status: input.status,
            to_chapter: input.currentChapter ?? 0,
            to_rating: input.rating ?? null,
            note: input.notes ?? null,
            metadata: {},
        });

        await assignTaxonomyTermsToWork(tx, {
            workId: newWork.id,
            termPublicIds: input.taxonomyTermPublicIds ?? [],
        });

        return {
            work: newWork,
            libraryEntry: newLibraryEntry,
            readingState: newReadingState,
        };
    });
}

export async function updateLibraryItem(database: Database, input: UpdateLibraryItemInput) {
    return await database.transaction(async (tx) => {
        const [existing] = await tx
            .select({
                workId: works.id,
                libraryEntryId: libraryEntries.id,
                previousStatus: libraryEntries.status,
                previousChapter: readingStates.current_chapter,
                previousRating: readingStates.rating,
                previousNotes: readingStates.notes,
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
                title: input.title.trim(),
                sort_title: sortTitle(input.title),
                description: input.description ?? null,
                summary: input.summary ?? null,
                publication_status: input.workStatus,
                content_rating: input.contentRating ?? "unknown",
                is_nsfw: input.isNsfw,
                version: sql`${works.version} + 1`,
            })
            .where(eq(works.id, existing.workId));

        const sourcePlatformId = await getSourcePlatformId(tx, input.source);
        await tx
            .update(workSources)
            .set({
                sourcePlatformId,
                url: input.url,
                normalized_url: normalizeUrl(input.url),
                external_id: input.externalId ?? null,
                title_on_source: input.title,
                author_on_source: input.author,
                chapter_count: input.chapterCount ?? null,
                word_count: input.wordCount ?? null,
                source_status: input.workStatus,
            })
            .where(and(eq(workSources.workId, existing.workId), eq(workSources.is_primary, true)));

        await createOrLinkContributor(tx, { workId: existing.workId, name: input.author });

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
                rating: input.rating ?? null,
                notes: input.notes ?? null,
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
                libraryEntryId: existing.libraryEntryId,
                event_type: eventType satisfies ReadingEventType,
                from_status: existing.previousStatus,
                to_status: input.status,
                from_chapter: existing.previousChapter,
                to_chapter: input.currentChapter ?? 0,
                from_rating: existing.previousRating,
                to_rating: input.rating ?? null,
                note: input.notes ?? null,
                metadata: {},
            });
        }

        await assignTaxonomyTermsToWork(tx, {
            workId: existing.workId,
            termPublicIds: input.taxonomyTermPublicIds ?? [],
        });

        return { workPublicId: input.workPublicId, libraryEntryPublicId: input.libraryEntryPublicId };
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

export async function deleteLibraryEntry(database: Database, publicId: string) {
    const [deletedLibraryEntry] = await database
        .delete(libraryEntries)
        .where(eq(libraryEntries.publicId, publicId))
        .returning({ id: libraryEntries.id, publicId: libraryEntries.publicId });

    if (!deletedLibraryEntry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Library entry not found" });
    }

    return deletedLibraryEntry;
}

export const deleteProgress = deleteLibraryEntry;

export async function listLibraryProgress(database: Database, input: LibraryQueryInput): Promise<ProgressQueryResult> {
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
    if (cursorData) {
        whereConditions.push(
            sortOrder === "asc"
                ? sql`${libraryEntries.publicId} > ${cursorData.id}`
                : sql`${libraryEntries.publicId} < ${cursorData.id}`
        );
    }
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const rows = await database
        .select({
            progressPublicId: libraryEntries.publicId,
            storyPublicId: works.publicId,
            storyTitle: works.title,
            storyAuthor: workSources.author_on_source,
            progressStatus: libraryEntries.status,
            progressCurrentChapter: readingStates.current_chapter,
            progressRating: readingStates.rating,
            storyStatus: works.publication_status,
            updatedAt: libraryEntries.updated_at,
            storySourceKey: sourcePlatforms.key,
            storyUrl: workSources.url,
            storyChapterCount: workSources.chapter_count,
            storyWordCount: workSources.word_count,
            storyIsNsfw: works.is_nsfw,
            storyDescription: works.description,
            progressNotes: readingStates.notes,
            createdAt: libraryEntries.created_at,
            storyVersion: works.version,
            progressVersion: libraryEntries.version,
        })
        .from(libraryEntries)
        .innerJoin(works, eq(works.id, libraryEntries.workId))
        .leftJoin(readingStates, eq(readingStates.libraryEntryId, libraryEntries.id))
        .leftJoin(workSources, and(eq(workSources.workId, works.id), eq(workSources.is_primary, true)))
        .leftJoin(sourcePlatforms, eq(sourcePlatforms.id, workSources.sourcePlatformId))
        .leftJoin(workTaxonomyEffective, eq(workTaxonomyEffective.workId, works.id))
        .leftJoin(taxonomyTerms, eq(taxonomyTerms.id, workTaxonomyEffective.termId))
        .leftJoin(taxonomyLabels, eq(taxonomyLabels.termId, taxonomyTerms.id))
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
    const workPublicIds = items.map((item) => item.storyPublicId);
    const taxonomyRows =
        workPublicIds.length > 0
            ? await database
                  .select({
                      workPublicId: works.publicId,
                      publicId: taxonomyTerms.publicId,
                      name: taxonomyTerms.name,
                      kind: taxonomyKinds.key,
                  })
                  .from(workTaxonomyEffective)
                  .innerJoin(works, eq(works.id, workTaxonomyEffective.workId))
                  .innerJoin(taxonomyTerms, eq(taxonomyTerms.id, workTaxonomyEffective.termId))
                  .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
                  .where(inArray(works.publicId, workPublicIds))
            : [];

    const taxonomyByWork = new Map<string, { kind: string; name: string; publicId: string }[]>();
    for (const taxonomyRow of taxonomyRows) {
        const terms = taxonomyByWork.get(taxonomyRow.workPublicId) ?? [];
        terms.push({
            kind: taxonomyRow.kind,
            name: taxonomyRow.name,
            publicId: taxonomyRow.publicId,
        });
        taxonomyByWork.set(taxonomyRow.workPublicId, terms);
    }

    return {
        data: items.map((item) => ({
            progressPublicId: item.progressPublicId,
            storyPublicId: item.storyPublicId,
            storyTitle: item.storyTitle,
            storyAuthor: item.storyAuthor ?? "Unknown",
            progressStatus: item.progressStatus,
            progressCurrentChapter: item.progressCurrentChapter ?? 0,
            progressRating: item.progressRating ?? 0,
            storyStatus: item.storyStatus,
            updatedAt: item.updatedAt ?? new Date(0),
            taxonomyTerms: taxonomyByWork.get(item.storyPublicId) ?? [],
            storySource: legacySourceBySourceKey[item.storySourceKey ?? "other"] ?? "Other",
            storyUrl: item.storyUrl ?? undefined,
            storyChapterCount: item.storyChapterCount ?? undefined,
            storyWordCount: item.storyWordCount ?? undefined,
            storyIsNsfw: item.storyIsNsfw,
            storyDescription: item.storyDescription,
            progressNotes: item.progressNotes,
            createdAt: item.createdAt ?? undefined,
            storyVersion: item.storyVersion,
            progressVersion: item.progressVersion,
        })),
        meta: {
            hasNextPage,
            nextCursor: hasNextPage ? createCursor(items.at(-1)?.progressPublicId ?? "") : undefined,
            ...(sanitizedSearch && { searchTerm: sanitizedSearch }),
        },
    };
}

export async function refreshLibraryView(_database: Database) {
    return { success: true };
}

export async function refreshLibraryStatsView(_database: Database) {
    return { success: true };
}

export async function refreshLibraryReadModels(_database: Database) {
    return { success: true };
}

export async function getLibraryStats() {
    "use cache";
    cacheTag(backendCacheTags.libraryStats);
    cacheLife("hours");

    const [stats] = await db
        .select({
            storyCount: sql<number>`COUNT(DISTINCT ${works.id})`,
            completed: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Completed' THEN 1 END)`,
            paused: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Paused' THEN 1 END)`,
            dropped: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Dropped' THEN 1 END)`,
            reading: sql<number>`COUNT(CASE WHEN ${libraryEntries.status} = 'Reading' THEN 1 END)`,
            averageRating: sql<number>`COALESCE(AVG(${readingStates.rating}), 0)`,
            totalChaptersRead: sql<number>`COALESCE(SUM(${readingStates.current_chapter}), 0)`,
            taxonomyTermCount: sql<number>`COUNT(DISTINCT ${workTaxonomyEffective.termId})`,
        })
        .from(libraryEntries)
        .innerJoin(works, eq(works.id, libraryEntries.workId))
        .leftJoin(readingStates, eq(readingStates.libraryEntryId, libraryEntries.id))
        .leftJoin(workTaxonomyEffective, eq(workTaxonomyEffective.workId, works.id));

    return stats ?? {};
}
