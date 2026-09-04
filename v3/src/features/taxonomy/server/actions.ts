"use server";

import { eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db/client";
import { taxonomyKind, taxonomyTerm } from "@/server/db/schema";
import type { MutationResult } from "@/server/query/mutation-result";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

export interface TaxonomyOption {
  id: string;
  label: string;
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
 * renders inside an authoring form.
 */
export const searchTaxonomyTermsAction = async (
  query: string
): Promise<TaxonomyOption[]> => {
  await requireAdmin();

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const rows = await db
    .select({ id: taxonomyTerm.publicId, label: taxonomyTerm.name })
    .from(taxonomyTerm)
    .where(
      sql`${taxonomyTerm.status} = 'active' and ${taxonomyTerm.name} % ${trimmed}`
    )
    .orderBy(sql`similarity(${taxonomyTerm.name}, ${trimmed}) desc`)
    .limit(MAX_RESULTS);

  return rows;
};

/**
 * Creates a term under the "custom" taxonomy kind if one with the same
 * normalized name doesn't already exist for that kind -- called only after
 * the picker's search has already surfaced no match, so this is a genuine
 * create, not a race-prone upsert path.
 */
export const createTaxonomyTermAction = async (
  name: string
): Promise<MutationResult<TaxonomyOption>> => {
  await requireAdmin();

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    return {
      fieldErrors: { name: ["Term name must be 1-100 characters."] },
      status: "validation-error",
    };
  }

  const [customKind] = await db
    .select({ id: taxonomyKind.id })
    .from(taxonomyKind)
    .where(eq(taxonomyKind.slug, "custom"))
    .limit(1);

  if (!customKind) {
    throw new Error("The 'custom' taxonomy kind is not seeded.");
  }

  const normalizedName = normalize(trimmed);
  const slug = slugify(trimmed);

  const [existing] = await db
    .select({ id: taxonomyTerm.publicId, label: taxonomyTerm.name })
    .from(taxonomyTerm)
    .where(
      sql`${taxonomyTerm.taxonomyKindId} = ${customKind.id} and ${taxonomyTerm.normalizedName} = ${normalizedName}`
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
      taxonomyKindId: customKind.id,
    })
    .returning({ id: taxonomyTerm.publicId, label: taxonomyTerm.name });

  if (!created) {
    throw new Error("Failed to create taxonomy term.");
  }

  return { data: created, status: "success" };
};
