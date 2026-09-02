import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cacheLife, cacheTag } from "next/cache";
import { backendCacheTags } from "#/server/backend/cache/tags";
import { db } from "#/server/db";
import { rebuildEffectiveTaxonomyForWork } from "#/server/db/repositories/library-repository";
import {
    type TaxonomyKind,
    type TaxonomyRelationType,
    taxonomyKindEnum,
    taxonomyKinds,
    taxonomyLabels,
    taxonomyRelations,
    taxonomyRelationTypeEnum,
    taxonomyTerms,
    workTaxonomyAssignments,
    workTaxonomyEffective,
} from "#/server/db/schema/taxonomy";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseOrTransaction = Database | Transaction;
const fromTerm = alias(taxonomyTerms, "from_term");
const fromKind = alias(taxonomyKinds, "from_kind");
const toTerm = alias(taxonomyTerms, "to_term");
const toKind = alias(taxonomyKinds, "to_kind");

export const TAXONOMY_NAME_MIN = 1;
export const TAXONOMY_NAME_MAX = 255;
export const MULTISELECT_LIMIT_MIN = 1;
export const MULTISELECT_LIMIT_MAX = 50;
export const MULTISELECT_LIMIT_DEFAULT = 10;
export const HOT_LIMIT_MIN = 1;
export const HOT_LIMIT_MAX = 20;
export const HOT_LIMIT_DEFAULT = 8;
export const LIST_LIMIT_MIN = 1;
export const LIST_LIMIT_MAX = 100;
export const LIST_LIMIT_DEFAULT = 50;

export type TaxonomyTermSummary = {
    kind: TaxonomyKind;
    name: string;
    publicId: string;
};

export type TaxonomyTermListRow = TaxonomyTermSummary & {
    slug: string;
    description: string | null;
    assignmentCount: number;
};

export type TaxonomyTermListResult = {
    terms: TaxonomyTermListRow[];
    total: number;
};

export type TaxonomyRelationSummary = {
    publicId: string;
    relationType: TaxonomyRelationType;
    fromTerm: TaxonomyTermSummary;
    toTerm: TaxonomyTermSummary;
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

function normalizeTaxonomyText(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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

async function getKindId(database: DatabaseOrTransaction, kind: TaxonomyKind) {
    const [kindRow] = await database
        .select({ id: taxonomyKinds.id })
        .from(taxonomyKinds)
        .where(eq(taxonomyKinds.key, kind))
        .limit(1);
    if (!kindRow) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Taxonomy kind seed is missing: ${kind}` });
    }
    return kindRow.id;
}

function kindPredicate(kind?: TaxonomyKind) {
    return kind ? eq(taxonomyKinds.key, kind) : undefined;
}

function exactLabelMatchPredicate(input: { kind?: TaxonomyKind; normalizedText: string; excludePublicId?: string }) {
    const conditions = [
        eq(taxonomyLabels.normalized_label, input.normalizedText),
        ...(input.kind ? [eq(taxonomyKinds.key, input.kind)] : []),
        ...(input.excludePublicId ? [sql`${taxonomyTerms.publicId} != ${input.excludePublicId}`] : []),
    ];

    return and(...conditions);
}

async function findTaxonomyTermByExactLabel(
    database: DatabaseOrTransaction,
    input: { kind?: TaxonomyKind; normalizedText: string; excludePublicId?: string }
) {
    const [term] = await database
        .select({
            id: taxonomyTerms.id,
            kind: taxonomyKinds.key,
            name: taxonomyTerms.name,
            publicId: taxonomyTerms.publicId,
        })
        .from(taxonomyTerms)
        .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
        .innerJoin(taxonomyLabels, eq(taxonomyLabels.termId, taxonomyTerms.id))
        .where(exactLabelMatchPredicate(input))
        .limit(1);

    return term
        ? {
              ...term,
              kind: taxonomyKindEnum.parse(term.kind),
          }
        : undefined;
}

export async function getHotTaxonomyTerms(
    input: { kind?: TaxonomyKind; limit?: number } = {}
): Promise<TaxonomyTermSummary[]> {
    "use cache";
    cacheTag(backendCacheTags.hotTaxonomyTerms);
    cacheLife("hours");

    const whereClause = kindPredicate(input.kind);

    const rows = await db
        .select({
            kind: taxonomyKinds.key,
            name: taxonomyTerms.name,
            publicId: taxonomyTerms.publicId,
        })
        .from(taxonomyTerms)
        .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
        .leftJoin(workTaxonomyAssignments, eq(taxonomyTerms.id, workTaxonomyAssignments.termId))
        .where(whereClause)
        .groupBy(
            taxonomyTerms.id,
            taxonomyTerms.publicId,
            taxonomyTerms.name,
            taxonomyKinds.key,
            taxonomyKinds.sort_order
        )
        .orderBy(
            desc(sql`COUNT(${workTaxonomyAssignments.termId})`),
            asc(taxonomyKinds.sort_order),
            asc(taxonomyTerms.name)
        )
        .limit(input.limit ?? HOT_LIMIT_DEFAULT);

    return rows.map((row) => ({
        kind: taxonomyKindEnum.parse(row.kind),
        name: row.name,
        publicId: row.publicId,
    }));
}

export async function searchTaxonomyTerms(
    input: TaxonomySearchInput & { limit?: number }
): Promise<TaxonomyTermSummary[]> {
    "use cache";
    cacheTag(backendCacheTags.taxonomySearch);
    cacheLife("minutes");

    const normalizedTerm = normalizeTaxonomyText(input.search ?? "");
    const similarityExpr = sql<number>`similarity(LOWER(${taxonomyLabels.label}), ${normalizedTerm})`;
    const maxSimilarityExpr = sql<number>`MAX(${similarityExpr})`;
    const minSimilarity = normalizedTerm.length < 4 ? 0.1 : 0.2;
    const searchClause = sql`(
        ${taxonomyLabels.normalized_label} ILIKE ${`%${normalizedTerm}%`}
        OR ${taxonomyTerms.normalized_name} ILIKE ${`%${normalizedTerm}%`}
        OR ${taxonomyTerms.slug} ILIKE ${`%${normalizedTerm}%`}
        OR ${similarityExpr} >= ${minSimilarity}
    )`;
    const whereClause = input.kind ? and(eq(taxonomyKinds.key, input.kind), searchClause) : searchClause;

    const rows = await db
        .select({
            kind: taxonomyKinds.key,
            name: taxonomyTerms.name,
            publicId: taxonomyTerms.publicId,
        })
        .from(taxonomyTerms)
        .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
        .leftJoin(taxonomyLabels, eq(taxonomyLabels.termId, taxonomyTerms.id))
        .where(whereClause)
        .groupBy(
            taxonomyTerms.id,
            taxonomyTerms.publicId,
            taxonomyTerms.name,
            taxonomyKinds.key,
            taxonomyKinds.sort_order
        )
        .orderBy(desc(maxSimilarityExpr), asc(taxonomyKinds.sort_order), asc(taxonomyTerms.name))
        .limit(input.limit ?? MULTISELECT_LIMIT_DEFAULT);

    return rows.map((row) => ({
        kind: taxonomyKindEnum.parse(row.kind),
        name: row.name,
        publicId: row.publicId,
    }));
}

export async function listTaxonomyTerms(input: {
    kind?: TaxonomyKind;
    search?: string;
    limit: number;
    offset: number;
}): Promise<TaxonomyTermListResult> {
    const trimmedSearch = input.search?.trim();
    // Search on `name`/`slug`, not `normalized_name` — those two columns carry the
    // gin_trgm_ops indexes (taxonomy_term_name_trgm_idx, taxonomy_term_slug_trgm_idx);
    // normalized_name has no trigram index, so ILIKE against it forces a sequential scan.
    const searchClause = trimmedSearch
        ? sql`(${taxonomyTerms.name} ILIKE ${`%${trimmedSearch}%`} OR ${taxonomyTerms.slug} ILIKE ${`%${trimmedSearch}%`})`
        : undefined;
    const whereClause = and(kindPredicate(input.kind), searchClause);

    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
        db
            .select({
                assignmentCount: sql<number>`count(${workTaxonomyAssignments.workId})::int`,
                description: taxonomyTerms.description,
                kind: taxonomyKinds.key,
                name: taxonomyTerms.name,
                publicId: taxonomyTerms.publicId,
                slug: taxonomyTerms.slug,
            })
            .from(taxonomyTerms)
            .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
            .leftJoin(workTaxonomyAssignments, eq(workTaxonomyAssignments.termId, taxonomyTerms.id))
            .where(whereClause)
            .groupBy(
                taxonomyTerms.id,
                taxonomyTerms.publicId,
                taxonomyTerms.name,
                taxonomyTerms.slug,
                taxonomyTerms.description,
                taxonomyKinds.key,
                taxonomyKinds.sort_order
            )
            .orderBy(asc(taxonomyKinds.sort_order), asc(taxonomyTerms.name))
            .limit(input.limit)
            .offset(input.offset),
        db
            .select({ total: sql<number>`count(*)::int` })
            .from(taxonomyTerms)
            .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
            .where(whereClause),
    ]);

    return {
        terms: rows.map((row) => ({
            assignmentCount: row.assignmentCount,
            description: row.description,
            kind: taxonomyKindEnum.parse(row.kind),
            name: row.name,
            publicId: row.publicId,
            slug: row.slug,
        })),
        total,
    };
}

export async function getTaxonomyMultiselect(input: TaxonomyMultiselectInput): Promise<TaxonomyMultiselectResult> {
    const term = input.search?.trim();
    if (!term && input.includeHot) {
        return {
            canCreate: false,
            searchTerm: null,
            terms: await getHotTaxonomyTerms({ kind: input.kind, limit: input.hotLimit }),
        };
    }

    if (!term) {
        return { canCreate: false, searchTerm: null, terms: [] };
    }

    const normalizedTerm = normalizeTaxonomyText(term);
    const [searchResults, exactMatch] = await Promise.all([
        searchTaxonomyTerms({ kind: input.kind, limit: input.limit, search: term }),
        findTaxonomyTermByExactLabel(db, { kind: input.kind, normalizedText: normalizedTerm }),
    ]);

    return {
        canCreate: !exactMatch,
        searchTerm: term,
        terms: searchResults,
    };
}

export async function createTaxonomyTerm(
    database: Database,
    input: { description?: string | null; kind: TaxonomyKind; name: string; slug?: string }
) {
    const name = input.name.trim();
    const normalizedName = normalizeTaxonomyText(name);
    const slug = input.slug?.trim() || slugifyTaxonomyName(name);
    const kindId = await getKindId(database, input.kind);

    const existingTerm = await findTaxonomyTermByExactLabel(database, {
        kind: input.kind,
        normalizedText: normalizedName,
    });

    if (existingTerm) {
        throw new TRPCError({ code: "CONFLICT", message: "Taxonomy term with this kind and name already exists" });
    }

    return await database.transaction(async (tx) => {
        const [newTerm] = await tx
            .insert(taxonomyTerms)
            .values({
                description: input.description ?? null,
                kindId,
                name,
                normalized_name: normalizedName,
                slug,
                status: "active",
            })
            .returning({
                id: taxonomyTerms.id,
                kindId: taxonomyTerms.kindId,
                name: taxonomyTerms.name,
                publicId: taxonomyTerms.publicId,
            });

        if (!newTerm) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create taxonomy term" });
        }

        await tx.insert(taxonomyLabels).values({
            is_primary: true,
            label: name,
            label_type: "primary",
            normalized_label: normalizedName,
            termId: newTerm.id,
        });

        return {
            id: newTerm.id,
            kind: input.kind,
            name: newTerm.name,
            publicId: newTerm.publicId,
        };
    });
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
                kind: taxonomyKinds.key,
                kindId: taxonomyTerms.kindId,
            })
            .from(taxonomyTerms)
            .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
            .where(eq(taxonomyTerms.publicId, publicId))
            .limit(1);

        if (!existingTerm) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Taxonomy term not found" });
        }

        const currentKind = taxonomyKindEnum.parse(existingTerm.kind);
        const nextKind = updateData.kind ?? currentKind;
        const nextKindId = updateData.kind ? await getKindId(tx, updateData.kind) : existingTerm.kindId;
        const nextName = updateData.name?.trim();
        const nextNormalizedName = nextName ? normalizeTaxonomyText(nextName) : undefined;
        const nextSlug = updateData.slug?.trim() || (nextName ? slugifyTaxonomyName(nextName) : undefined);

        if (nextNormalizedName) {
            const conflictingTerm = await findTaxonomyTermByExactLabel(tx, {
                excludePublicId: publicId,
                kind: nextKind,
                normalizedText: nextNormalizedName,
            });

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
                description: updateData.description,
                ...(updateData.kind && { kindId: nextKindId }),
                ...(nextName && { name: nextName }),
                ...(nextNormalizedName && { normalized_name: nextNormalizedName }),
                ...(nextSlug && { slug: nextSlug }),
                version: sql`${taxonomyTerms.version} + 1`,
            })
            .where(eq(taxonomyTerms.publicId, publicId))
            .returning({
                id: taxonomyTerms.id,
                name: taxonomyTerms.name,
                publicId: taxonomyTerms.publicId,
            });

        if (!updatedTerm) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Taxonomy term not found" });
        }

        if (nextName && nextNormalizedName) {
            await tx
                .update(taxonomyLabels)
                .set({
                    label: nextName,
                    normalized_label: nextNormalizedName,
                })
                .where(and(eq(taxonomyLabels.termId, existingTerm.id), eq(taxonomyLabels.is_primary, true)));
        }

        return {
            id: updatedTerm.id,
            kind: nextKind,
            name: updatedTerm.name,
            publicId: updatedTerm.publicId,
        };
    });
}

export async function createTaxonomyTermForMultiselect(
    database: Database,
    input: { kind: TaxonomyKind; name: string }
) {
    const name = input.name.trim();
    const normalizedName = normalizeTaxonomyText(name);
    const existingTerm = await findTaxonomyTermByExactLabel(database, {
        kind: input.kind,
        normalizedText: normalizedName,
    });

    if (existingTerm) {
        return existingTerm;
    }

    return await createTaxonomyTerm(database, {
        kind: input.kind,
        name,
        slug: slugifyTaxonomyName(name),
    });
}

async function getTermByPublicId(database: DatabaseOrTransaction, publicId: string) {
    const [term] = await database
        .select({
            id: taxonomyTerms.id,
            kind: taxonomyKinds.key,
            name: taxonomyTerms.name,
            publicId: taxonomyTerms.publicId,
        })
        .from(taxonomyTerms)
        .innerJoin(taxonomyKinds, eq(taxonomyKinds.id, taxonomyTerms.kindId))
        .where(eq(taxonomyTerms.publicId, publicId))
        .limit(1);

    if (!term) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Taxonomy term not found" });
    }

    return {
        ...term,
        kind: taxonomyKindEnum.parse(term.kind),
    };
}

export async function listTaxonomyRelations(database: Database, input: { termPublicId?: string } = {}) {
    const term = input.termPublicId ? await getTermByPublicId(database, input.termPublicId) : null;
    const whereClause = term
        ? sql`${taxonomyRelations.fromTermId} = ${term.id} OR ${taxonomyRelations.toTermId} = ${term.id}`
        : undefined;

    const rows = await database
        .select({
            fromTermKind: fromKind.key,
            fromTermName: fromTerm.name,
            fromTermPublicId: fromTerm.publicId,
            publicId: taxonomyRelations.publicId,
            relationType: taxonomyRelations.relation_type,
            toTermKind: toKind.key,
            toTermName: toTerm.name,
            toTermPublicId: toTerm.publicId,
        })
        .from(taxonomyRelations)
        .innerJoin(fromTerm, eq(fromTerm.id, taxonomyRelations.fromTermId))
        .innerJoin(fromKind, eq(fromKind.id, fromTerm.kindId))
        .innerJoin(toTerm, eq(toTerm.id, taxonomyRelations.toTermId))
        .innerJoin(toKind, eq(toKind.id, toTerm.kindId))
        .where(whereClause)
        .orderBy(asc(taxonomyRelations.relation_type), asc(fromTerm.name), asc(toTerm.name));

    return rows.map(
        (row): TaxonomyRelationSummary => ({
            fromTerm: {
                kind: taxonomyKindEnum.parse(row.fromTermKind),
                name: row.fromTermName,
                publicId: row.fromTermPublicId,
            },
            publicId: row.publicId,
            relationType: taxonomyRelationTypeEnum.parse(row.relationType),
            toTerm: {
                kind: taxonomyKindEnum.parse(row.toTermKind),
                name: row.toTermName,
                publicId: row.toTermPublicId,
            },
        })
    );
}

export async function createTaxonomyRelation(
    database: Database,
    input: { fromTermPublicId: string; relationType: TaxonomyRelationType; toTermPublicId: string }
) {
    if (input.fromTermPublicId === input.toTermPublicId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Taxonomy relation cannot point to itself" });
    }

    return await database.transaction(async (tx) => {
        const [fromTerm, toTerm] = await Promise.all([
            getTermByPublicId(tx, input.fromTermPublicId),
            getTermByPublicId(tx, input.toTermPublicId),
        ]);

        const [relation] = await tx
            .insert(taxonomyRelations)
            .values({
                fromTermId: fromTerm.id,
                relation_type: input.relationType,
                toTermId: toTerm.id,
            })
            .onConflictDoUpdate({
                set: { updated_at: sql`CURRENT_TIMESTAMP` },
                target: [taxonomyRelations.fromTermId, taxonomyRelations.toTermId, taxonomyRelations.relation_type],
            })
            .returning({
                id: taxonomyRelations.id,
                publicId: taxonomyRelations.publicId,
                relationType: taxonomyRelations.relation_type,
            });

        const affectedWorks = await tx
            .select({ workId: workTaxonomyEffective.workId })
            .from(workTaxonomyEffective)
            .where(eq(workTaxonomyEffective.termId, fromTerm.id))
            .groupBy(workTaxonomyEffective.workId);

        for (const affectedWork of affectedWorks) {
            await rebuildEffectiveTaxonomyForWork(tx, affectedWork.workId);
        }

        return {
            affectedWorkIds: affectedWorks.map((work) => work.workId),
            publicId: relation?.publicId,
            relationType: relation ? taxonomyRelationTypeEnum.parse(relation.relationType) : input.relationType,
        };
    });
}

export async function deleteTaxonomyRelation(database: Database, publicId: string) {
    return await database.transaction(async (tx) => {
        const [relation] = await tx
            .delete(taxonomyRelations)
            .where(eq(taxonomyRelations.publicId, publicId))
            .returning({
                fromTermId: taxonomyRelations.fromTermId,
                id: taxonomyRelations.id,
                publicId: taxonomyRelations.publicId,
            });

        if (!relation) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Taxonomy relation not found" });
        }

        const affectedWorks = await tx
            .select({ workId: workTaxonomyEffective.workId })
            .from(workTaxonomyEffective)
            .where(eq(workTaxonomyEffective.termId, relation.fromTermId))
            .groupBy(workTaxonomyEffective.workId);

        for (const affectedWork of affectedWorks) {
            await rebuildEffectiveTaxonomyForWork(tx, affectedWork.workId);
        }

        return {
            affectedWorkIds: affectedWorks.map((work) => work.workId),
            publicId: relation.publicId,
        };
    });
}

export async function deleteTaxonomyTerm(database: Database, publicId: string) {
    const [deletedTerm] = await database.delete(taxonomyTerms).where(eq(taxonomyTerms.publicId, publicId)).returning({
        id: taxonomyTerms.id,
        publicId: taxonomyTerms.publicId,
    });

    if (!deletedTerm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Taxonomy term not found" });
    }

    return deletedTerm;
}
