import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { backendCacheTags } from "#/server/backend/cache/tags";
import { db } from "#/server/db";
import { storyTaxonomyTerms } from "#/server/db/schema/story";
import { type TaxonomyKind, taxonomyTerms } from "#/server/db/schema/taxonomy";

type Database = typeof db;

export const TAXONOMY_NAME_MIN = 1;
export const TAXONOMY_NAME_MAX = 255;
export const MULTISELECT_LIMIT_MIN = 1;
export const MULTISELECT_LIMIT_MAX = 50;
export const MULTISELECT_LIMIT_DEFAULT = 10;
export const HOT_LIMIT_MIN = 1;
export const HOT_LIMIT_MAX = 20;
export const HOT_LIMIT_DEFAULT = 8;

export type TaxonomyTermSummary = {
    kind: TaxonomyKind;
    name: string;
    publicId: string;
};

export type TaxonomyMultiselectResult = {
    canCreate: boolean;
    searchTerm: string | null;
    terms: TaxonomyTermSummary[];
};

type TaxonomySearchInput = {
    kind?: TaxonomyKind;
    search?: string;
};

type TaxonomyMultiselectInput = TaxonomySearchInput & {
    includeHot: boolean;
    hotLimit: number;
    limit: number;
};

function slugifyTaxonomyName(name: string) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, TAXONOMY_NAME_MAX);

    return slug || "term";
}

function kindPredicate(kind?: TaxonomyKind) {
    return kind ? eq(taxonomyTerms.kind, kind) : undefined;
}

export async function getHotTaxonomyTerms(input: { kind?: TaxonomyKind; limit?: number } = {}) {
    "use cache";
    cacheTag(backendCacheTags.hotTaxonomyTerms);
    cacheLife("hours");

    const whereClause = kindPredicate(input.kind);

    return await db
        .select({
            publicId: taxonomyTerms.publicId,
            name: taxonomyTerms.name,
            kind: taxonomyTerms.kind,
        })
        .from(taxonomyTerms)
        .leftJoin(storyTaxonomyTerms, eq(taxonomyTerms.id, storyTaxonomyTerms.termId))
        .where(whereClause)
        .groupBy(taxonomyTerms.id, taxonomyTerms.publicId, taxonomyTerms.name, taxonomyTerms.kind)
        .orderBy(desc(sql`COUNT(${storyTaxonomyTerms.termId})`), asc(taxonomyTerms.kind), asc(taxonomyTerms.name))
        .limit(input.limit ?? HOT_LIMIT_DEFAULT);
}

export async function searchTaxonomyTerms(input: TaxonomySearchInput & { limit?: number }) {
    "use cache";
    cacheTag(backendCacheTags.taxonomySearch);
    cacheLife("minutes");

    const normalizedTerm = input.search?.trim().toLowerCase() ?? "";
    const similarityExpr = sql<number>`similarity(LOWER(${taxonomyTerms.name}), ${normalizedTerm})`;
    const minSimilarity = normalizedTerm.length < 4 ? 0.1 : 0.2;
    const searchClause = sql`(
        LOWER(${taxonomyTerms.name}) ILIKE ${`%${normalizedTerm}%`}
        OR LOWER(${taxonomyTerms.slug}) ILIKE ${`%${normalizedTerm}%`}
        OR ${similarityExpr} >= ${minSimilarity}
    )`;
    const whereClause = input.kind ? and(eq(taxonomyTerms.kind, input.kind), searchClause) : searchClause;

    return await db
        .select({
            publicId: taxonomyTerms.publicId,
            name: taxonomyTerms.name,
            kind: taxonomyTerms.kind,
        })
        .from(taxonomyTerms)
        .where(whereClause)
        .orderBy(desc(similarityExpr), asc(taxonomyTerms.kind), asc(taxonomyTerms.name))
        .limit(input.limit ?? MULTISELECT_LIMIT_DEFAULT);
}

export async function getTaxonomyMultiselect(input: TaxonomyMultiselectInput): Promise<TaxonomyMultiselectResult> {
    const term = input.search?.trim();
    if (!term && input.includeHot) {
        return {
            terms: await getHotTaxonomyTerms({ kind: input.kind, limit: input.hotLimit }),
            canCreate: false,
            searchTerm: null,
        };
    }

    if (!term) {
        return {
            terms: [],
            canCreate: false,
            searchTerm: null,
        };
    }

    const exactMatchClause = input.kind
        ? and(eq(taxonomyTerms.kind, input.kind), sql`LOWER(${taxonomyTerms.name}) = LOWER(${term})`)
        : sql`LOWER(${taxonomyTerms.name}) = LOWER(${term})`;

    const [searchResults, exactMatch] = await Promise.all([
        searchTaxonomyTerms({ kind: input.kind, search: term, limit: input.limit }),
        db.select({ id: taxonomyTerms.id }).from(taxonomyTerms).where(exactMatchClause).limit(1),
    ]);

    return {
        terms: searchResults,
        canCreate: exactMatch.length === 0,
        searchTerm: term,
    };
}

export async function createTaxonomyTerm(
    database: Database,
    input: { description?: string | null; kind: TaxonomyKind; name: string; slug?: string }
) {
    const name = input.name.trim();
    const slug = input.slug?.trim() || slugifyTaxonomyName(name);

    const existingTerm = await database
        .select({ id: taxonomyTerms.id })
        .from(taxonomyTerms)
        .where(and(eq(taxonomyTerms.kind, input.kind), eq(taxonomyTerms.name, name)))
        .limit(1);

    if (existingTerm.length > 0) {
        throw new TRPCError({
            code: "CONFLICT",
            message: "Taxonomy term with this kind and name already exists",
        });
    }

    const [newTerm] = await database
        .insert(taxonomyTerms)
        .values({
            kind: input.kind,
            name,
            slug,
            description: input.description ?? null,
        })
        .returning({
            id: taxonomyTerms.id,
            publicId: taxonomyTerms.publicId,
            kind: taxonomyTerms.kind,
            name: taxonomyTerms.name,
        });

    if (!newTerm) {
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create taxonomy term",
        });
    }

    return newTerm;
}

export async function updateTaxonomyTerm(
    database: Database,
    input: { description?: string | null; kind?: TaxonomyKind; name?: string; publicId: string; slug?: string }
) {
    const { publicId, ...updateData } = input;

    return await database.transaction(async (tx) => {
        const [existingTerm] = await tx
            .select({
                id: taxonomyTerms.id,
                kind: taxonomyTerms.kind,
            })
            .from(taxonomyTerms)
            .where(eq(taxonomyTerms.publicId, publicId))
            .limit(1);

        if (!existingTerm) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Taxonomy term not found",
            });
        }

        const nextKind = updateData.kind ?? existingTerm.kind;
        const nextName = updateData.name?.trim();
        const nextSlug = updateData.slug?.trim() || (nextName ? slugifyTaxonomyName(nextName) : undefined);

        if (nextName) {
            const [conflictingTerm] = await tx
                .select({ id: taxonomyTerms.id })
                .from(taxonomyTerms)
                .where(
                    and(
                        eq(taxonomyTerms.kind, nextKind),
                        eq(taxonomyTerms.name, nextName),
                        sql`${taxonomyTerms.publicId} != ${publicId}`
                    )
                )
                .limit(1);

            if (conflictingTerm) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Taxonomy term with this kind and name already exists",
                });
            }
        }

        const [updatedTerm] = await tx
            .update(taxonomyTerms)
            .set({
                ...updateData,
                ...(nextName && { name: nextName }),
                ...(nextSlug && { slug: nextSlug }),
                version: sql`${taxonomyTerms.version} + 1`,
            })
            .where(eq(taxonomyTerms.publicId, publicId))
            .returning({
                id: taxonomyTerms.id,
                publicId: taxonomyTerms.publicId,
                kind: taxonomyTerms.kind,
                name: taxonomyTerms.name,
            });

        if (!updatedTerm) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Taxonomy term not found",
            });
        }

        return updatedTerm;
    });
}

export async function createTaxonomyTermForMultiselect(
    database: Database,
    input: { kind: TaxonomyKind; name: string }
) {
    const name = input.name.trim();
    const existingTerm = await database
        .select({
            publicId: taxonomyTerms.publicId,
            name: taxonomyTerms.name,
            kind: taxonomyTerms.kind,
        })
        .from(taxonomyTerms)
        .where(and(eq(taxonomyTerms.kind, input.kind), sql`LOWER(${taxonomyTerms.name}) = LOWER(${name})`))
        .limit(1);

    if (existingTerm.length > 0) {
        return existingTerm[0];
    }

    return await createTaxonomyTerm(database, {
        kind: input.kind,
        name,
        slug: slugifyTaxonomyName(name),
    });
}

export async function deleteTaxonomyTerm(database: Database, publicId: string) {
    const [deletedTerm] = await database.delete(taxonomyTerms).where(eq(taxonomyTerms.publicId, publicId)).returning({
        id: taxonomyTerms.id,
        publicId: taxonomyTerms.publicId,
    });

    if (!deletedTerm) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Taxonomy term not found",
        });
    }

    return deletedTerm;
}
