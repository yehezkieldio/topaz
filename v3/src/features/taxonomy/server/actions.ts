"use server";

import { and, count, desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db/client";
import type { taxonomyRelation } from "@/server/db/schema";
import {
  taxonomyKind,
  taxonomyTerm,
  workTaxonomyAssignment,
} from "@/server/db/schema";
import type { MutationResult } from "@/server/query/mutation-result";

import { taxonomyTermTag, workTaxonomyEffectiveTag } from "./cache-tags";
import { rebuildEffectiveTaxonomyForWorks } from "./repository/effective-taxonomy";
import {
  deleteLabel,
  findLabelByPublicId,
  insertLabel,
  listLabelsForTerm,
  setPrimaryLabel,
} from "./repository/labels";
import { mergeTerms } from "./repository/merge";
import {
  deleteRelation,
  findWorkIdsAssignedToTerm,
  findWorkPublicIds,
  insertRelation,
  listRelationsForTerm,
} from "./repository/relations";
import {
  changeTermKind,
  findKindBySlug,
  findTermByPublicId,
  renameTerm,
} from "./repository/terms";

type RelationType = (typeof taxonomyRelation.relationType.enumValues)[number];

/**
 * Rebuilds effective taxonomy for every affected work in one batched pass
 * (O(MAX_DEPTH) round trips total, not O(workIds.length * MAX_DEPTH)) --
 * see rebuildEffectiveTaxonomyForWorks and
 * topaz-v3-specs/07_backend/01_query_and_n_plus_one_policy.md.
 */
const rebuildAndRevalidate = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workIds: string[]
) => {
  await rebuildEffectiveTaxonomyForWorks(tx, workIds);
  return await findWorkPublicIds(tx, workIds);
};

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

/**
 * A chip's Option shape carries only {id, label} -- no version -- so the
 * chip menu looks the current version up right before opening the edit
 * popover, rather than threading a version through every taxonomy picker's
 * option type just for this low-friction, single-entity edit surface.
 */
export const getTermVersionAction = async (
  termPublicId: string
): Promise<number | null> => {
  await requireAdmin();
  const [row] = await db
    .select({ version: taxonomyTerm.version })
    .from(taxonomyTerm)
    .where(eq(taxonomyTerm.publicId, termPublicId))
    .limit(1);
  return row?.version ?? null;
};

export interface TaxonomyOption {
  id: string;
  label: string;
  kind: string;
}

const normalize = (value: string) => value.trim().toLowerCase();

const slugify = (value: string) =>
  normalize(value)
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

/**
 * Trigram similarity search over active taxonomy terms -- surfaced by the
 * taxonomy picker before a duplicate term is created, per the roadmap's
 * "taxonomy-suggestion" requirement. Admin-only: the picker only ever
 * renders inside an authoring form. `kindSlug` scopes the search to one
 * taxonomy kind (topaz-v3-specs/06_library/04_taxonomy_picker.md); omit it
 * to search across every kind.
 */
export const searchTaxonomyTermsAction = async (
  query: string,
  kindSlug?: string
): Promise<TaxonomyOption[]> => {
  await requireAdmin();

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const rows = await db
    .select({
      id: taxonomyTerm.publicId,
      kind: taxonomyKind.slug,
      label: taxonomyTerm.name,
    })
    .from(taxonomyTerm)
    .innerJoin(taxonomyKind, eq(taxonomyKind.id, taxonomyTerm.taxonomyKindId))
    .where(
      and(
        eq(taxonomyTerm.status, "active"),
        sql`${taxonomyTerm.name} % ${trimmed}`,
        kindSlug ? eq(taxonomyKind.slug, kindSlug) : undefined
      )
    )
    .orderBy(sql`similarity(${taxonomyTerm.name}, ${trimmed}) desc`)
    .limit(MAX_RESULTS);

  return rows;
};

const MAX_HOT_TERMS = 20;

/**
 * "Hot terms" default view shown when the picker's query is empty --
 * ordered by how many works currently carry the term directly, not by
 * recency (topaz-v3-specs/06_library/04_taxonomy_picker.md).
 */
export const listHotTaxonomyTermsAction = async (
  kindSlug?: string
): Promise<TaxonomyOption[]> => {
  await requireAdmin();

  return await db
    .select({
      id: taxonomyTerm.publicId,
      kind: taxonomyKind.slug,
      label: taxonomyTerm.name,
    })
    .from(workTaxonomyAssignment)
    .innerJoin(
      taxonomyTerm,
      eq(taxonomyTerm.id, workTaxonomyAssignment.taxonomyTermId)
    )
    .innerJoin(taxonomyKind, eq(taxonomyKind.id, taxonomyTerm.taxonomyKindId))
    .where(
      and(
        eq(taxonomyTerm.status, "active"),
        kindSlug ? eq(taxonomyKind.slug, kindSlug) : undefined
      )
    )
    .groupBy(taxonomyTerm.id, taxonomyKind.slug)
    .orderBy(desc(count(workTaxonomyAssignment.workId)))
    .limit(MAX_HOT_TERMS);
};

/**
 * Creates a term under the given taxonomy kind (default "custom") if one
 * with the same normalized name doesn't already exist for that kind --
 * called only after the picker's search has already surfaced no match, so
 * this is a genuine create, not a race-prone upsert path.
 */
export const createTaxonomyTermAction = async (
  name: string,
  kindSlug = "custom"
): Promise<MutationResult<TaxonomyOption>> => {
  await requireAdmin();

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return {
      fieldErrors: { name: ["Term name must be 1-100 characters."] },
      status: "validation-error",
    };
  }

  const [kind] = await db
    .select({ id: taxonomyKind.id, slug: taxonomyKind.slug })
    .from(taxonomyKind)
    .where(eq(taxonomyKind.slug, kindSlug))
    .limit(1);

  if (!kind) {
    return {
      fieldErrors: { kind: ["Unknown taxonomy kind."] },
      status: "validation-error",
    };
  }

  const normalizedName = normalize(trimmed);
  const slug = slugify(trimmed);

  const [existing] = await db
    .select({
      id: taxonomyTerm.publicId,
      kind: taxonomyKind.slug,
      label: taxonomyTerm.name,
    })
    .from(taxonomyTerm)
    .innerJoin(taxonomyKind, eq(taxonomyKind.id, taxonomyTerm.taxonomyKindId))
    .where(
      and(
        eq(taxonomyTerm.taxonomyKindId, kind.id),
        eq(taxonomyTerm.normalizedName, normalizedName)
      )
    )
    .limit(1);

  if (existing) {
    return { data: existing, status: "success" };
  }

  const [created] = await db
    .insert(taxonomyTerm)
    .values({
      name: trimmed,
      normalizedName,
      slug,
      taxonomyKindId: kind.id,
    })
    .returning({ id: taxonomyTerm.publicId, label: taxonomyTerm.name });

  if (!created) {
    throw new Error("Failed to create taxonomy term.");
  }

  return { data: { ...created, kind: kind.slug }, status: "success" };
};

export interface TermMutationResult {
  id: string;
  label: string;
  version: number;
}

/**
 * Renames a term. Not an assignment/relation change, so no effective-taxonomy
 * rebuild is triggered -- only the term's own tag is invalidated.
 */
export const renameTermAction = async (
  termPublicId: string,
  expectedVersion: number,
  name: string
): Promise<MutationResult<TermMutationResult>> => {
  await requireAdmin();

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return {
      fieldErrors: { name: ["Term name must be 1-100 characters."] },
      status: "validation-error",
    };
  }

  const result = await db.transaction(async (tx) => {
    const current = await findTermByPublicId(tx, termPublicId);
    if (!current) {
      return { status: "not-found" as const };
    }
    if (current.version !== expectedVersion) {
      return {
        currentVersion: current.version,
        status: "version-conflict" as const,
      };
    }

    const [updated] = await renameTerm(
      tx,
      current.id,
      current.version,
      trimmed
    );
    if (!updated) {
      throw new Error("Failed to rename taxonomy term.");
    }

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(taxonomyTermTag(termPublicId), "max");
  }

  return result;
};

export const changeTermKindAction = async (
  termPublicId: string,
  expectedVersion: number,
  kindSlug: string
): Promise<MutationResult<{ id: string; version: number }>> => {
  await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const current = await findTermByPublicId(tx, termPublicId);
    if (!current) {
      return { status: "not-found" as const };
    }
    if (current.version !== expectedVersion) {
      return {
        currentVersion: current.version,
        status: "version-conflict" as const,
      };
    }

    const kind = await findKindBySlug(tx, kindSlug);
    if (!kind) {
      return {
        fieldErrors: { kind: ["Unknown taxonomy kind."] },
        status: "validation-error" as const,
      };
    }

    const [updated] = await changeTermKind(
      tx,
      current.id,
      current.version,
      kind.id
    );
    if (!updated) {
      throw new Error("Failed to change taxonomy term kind.");
    }

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(taxonomyTermTag(termPublicId), "max");
  }

  return result;
};

export interface RelationRow {
  id: string;
  fromTermId: string;
  toTermId: string;
  relationType: RelationType;
}

export const listTermRelationsAction = async (
  termPublicId: string
): Promise<RelationRow[]> => {
  await requireAdmin();

  return await db.transaction(async (tx) => {
    const current = await findTermByPublicId(tx, termPublicId);
    if (!current) {
      return [];
    }
    return await listRelationsForTerm(tx, current.id);
  });
};

/**
 * Adds a relation edge and rebuilds effective taxonomy for every work
 * assigned either endpoint term, since a new propagating edge can add
 * inferred rows to works that were already tagged before the edge existed.
 */
export const addRelationAction = async (
  fromTermPublicId: string,
  toTermPublicId: string,
  relationType: RelationType
): Promise<MutationResult<{ id: string }>> => {
  await requireAdmin();

  if (fromTermPublicId === toTermPublicId) {
    return {
      fieldErrors: { toTermId: ["A term cannot relate to itself."] },
      status: "validation-error",
    };
  }

  const result = await db.transaction(async (tx) => {
    const [fromTerm, toTerm] = await Promise.all([
      findTermByPublicId(tx, fromTermPublicId),
      findTermByPublicId(tx, toTermPublicId),
    ]);
    if (!(fromTerm && toTerm)) {
      return { status: "not-found" as const };
    }

    const [[inserted], fromWorkIds, toWorkIds] = await Promise.all([
      insertRelation(tx, fromTerm.id, toTerm.id, relationType),
      findWorkIdsAssignedToTerm(tx, fromTerm.id),
      findWorkIdsAssignedToTerm(tx, toTerm.id),
    ]);

    const affectedWorkIds = new Set([...fromWorkIds, ...toWorkIds]);
    const affectedWorkPublicIds = await rebuildAndRevalidate(tx, [
      ...affectedWorkIds,
    ]);

    return {
      affectedWorkPublicIds,
      data: { id: inserted?.id ?? "" },
      status: "success" as const,
    };
  });

  if (result.status === "success") {
    for (const workPublicId of result.affectedWorkPublicIds) {
      revalidateTag(workTaxonomyEffectiveTag(workPublicId), "max");
    }
  }

  return result;
};

export const deleteRelationAction = async (
  relationPublicId: string
): Promise<MutationResult<{ id: string }>> => {
  await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [deleted] = await deleteRelation(tx, relationPublicId);
    if (!deleted) {
      return { status: "not-found" as const };
    }

    const affectedWorkIds = new Set([
      ...(await findWorkIdsAssignedToTerm(tx, deleted.fromTermId)),
      ...(await findWorkIdsAssignedToTerm(tx, deleted.toTermId)),
    ]);
    const affectedWorkPublicIds = await rebuildAndRevalidate(tx, [
      ...affectedWorkIds,
    ]);

    return {
      affectedWorkPublicIds,
      data: { id: relationPublicId },
      status: "success" as const,
    };
  });

  if (result.status === "success") {
    for (const workPublicId of result.affectedWorkPublicIds) {
      revalidateTag(workTaxonomyEffectiveTag(workPublicId), "max");
    }
  }

  return result;
};

/**
 * Merges `losingTermPublicId` into `winningTermPublicId`: reassigns
 * work_taxonomy_assignment and taxonomy_relation rows, marks the loser
 * `status: "merged"`, and rebuilds effective taxonomy for every affected
 * work -- all inside one transaction (06_library/05_taxonomy_in_sheets.md).
 */
export const mergeTermsAction = async (
  winningTermPublicId: string,
  losingTermPublicId: string
): Promise<MutationResult<{ winningTermId: string }>> => {
  await requireAdmin();

  if (winningTermPublicId === losingTermPublicId) {
    return {
      fieldErrors: { losingTermId: ["Cannot merge a term into itself."] },
      status: "validation-error",
    };
  }

  const result = await db.transaction(async (tx) => {
    const [winner, loser] = await Promise.all([
      findTermByPublicId(tx, winningTermPublicId),
      findTermByPublicId(tx, losingTermPublicId),
    ]);
    if (!(winner && loser)) {
      return { status: "not-found" as const };
    }

    const affectedWorkIds = await mergeTerms(tx, winner.id, loser.id);
    const affectedWorkPublicIds = await rebuildAndRevalidate(
      tx,
      affectedWorkIds
    );

    return {
      affectedWorkPublicIds,
      data: { winningTermId: winningTermPublicId },
      status: "success" as const,
    };
  });

  if (result.status === "success") {
    revalidateTag(taxonomyTermTag(losingTermPublicId), "max");
    revalidateTag(taxonomyTermTag(winningTermPublicId), "max");
    for (const workPublicId of result.affectedWorkPublicIds) {
      revalidateTag(workTaxonomyEffectiveTag(workPublicId), "max");
    }
  }

  return result;
};

export interface TaxonomyKindOption {
  slug: string;
  name: string;
}

export const listTaxonomyKindsAction = async (): Promise<
  TaxonomyKindOption[]
> => {
  await requireAdmin();
  return await db
    .select({ name: taxonomyKind.name, slug: taxonomyKind.slug })
    .from(taxonomyKind)
    .orderBy(taxonomyKind.name);
};

const MAX_LABEL_LENGTH = 100;

export interface LabelMutationResult {
  id: string;
  label: string;
  isPrimary: boolean;
}

export const listTermLabelsAction = async (
  termPublicId: string
): Promise<LabelMutationResult[]> => {
  await requireAdmin();
  return await db.transaction(async (tx) => {
    const term = await findTermByPublicId(tx, termPublicId);
    if (!term) {
      return [];
    }
    return await listLabelsForTerm(tx, term.id);
  });
};

/**
 * Adds an alias/label for a term. Not an assignment/relation change, so no
 * effective-taxonomy rebuild -- labels are display metadata only.
 */
export const addTermLabelAction = async (
  termPublicId: string,
  label: string
): Promise<MutationResult<LabelMutationResult>> => {
  await requireAdmin();

  const trimmed = label.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_LABEL_LENGTH) {
    return {
      fieldErrors: {
        label: [`Label must be 1-${MAX_LABEL_LENGTH} characters.`],
      },
      status: "validation-error",
    };
  }

  const result = await db.transaction(async (tx) => {
    const term = await findTermByPublicId(tx, termPublicId);
    if (!term) {
      return { status: "not-found" as const };
    }

    const existing = await listLabelsForTerm(tx, term.id);
    const isFirstLabel = existing.length === 0;

    // Pre-check rather than try/catch around the insert -- a unique
    // constraint violation aborts the whole Postgres transaction, so
    // catching it here can't recover cleanly (the next statement would
    // fail with "current transaction is aborted"). citext makes the
    // uniqueness case-insensitive, so compare the same way here.
    const duplicate = existing.some(
      (row) => row.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      return {
        fieldErrors: { label: ["This label already exists for this term."] },
        status: "validation-error" as const,
      };
    }

    const [inserted] = await insertLabel(tx, term.id, trimmed, isFirstLabel);
    if (!inserted) {
      throw new Error("Failed to add taxonomy label.");
    }
    return { data: inserted, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(taxonomyTermTag(termPublicId), "max");
  }

  return result;
};

export const deleteTermLabelAction = async (
  labelPublicId: string
): Promise<MutationResult<{ id: string }>> => {
  await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const label = await findLabelByPublicId(tx, labelPublicId);
    if (!label) {
      return { status: "not-found" as const };
    }
    await deleteLabel(tx, label.id);
    return {
      data: { id: labelPublicId },
      status: "success" as const,
      termId: label.taxonomyTermId,
    };
  });

  if (result.status === "success") {
    const term = await db
      .select({ publicId: taxonomyTerm.publicId })
      .from(taxonomyTerm)
      .where(eq(taxonomyTerm.id, result.termId))
      .limit(1);
    const termPublicId = term.at(0)?.publicId;
    if (termPublicId) {
      revalidateTag(taxonomyTermTag(termPublicId), "max");
    }
  }

  return result;
};

export const setPrimaryTermLabelAction = async (
  termPublicId: string,
  labelPublicId: string
): Promise<MutationResult<LabelMutationResult>> => {
  await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [term, label] = await Promise.all([
      findTermByPublicId(tx, termPublicId),
      findLabelByPublicId(tx, labelPublicId),
    ]);
    if (!(term && label) || label.taxonomyTermId !== term.id) {
      return { status: "not-found" as const };
    }

    const [updated] = await setPrimaryLabel(tx, term.id, label.id);
    if (!updated) {
      throw new Error("Failed to set primary taxonomy label.");
    }
    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(taxonomyTermTag(termPublicId), "max");
  }

  return result;
};
