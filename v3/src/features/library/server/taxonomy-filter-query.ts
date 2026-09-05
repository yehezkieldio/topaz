import "server-only";
import { eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";
import {
  libraryEntry,
  taxonomyTerm,
  work,
  workTaxonomyEffective,
} from "@/server/db/schema";

const MAX_FILTERABLE_TERMS = 50;

/**
 * Public, non-admin-gated -- the library list and its filters are visible to
 * anyone, unlike searchTaxonomyTermsAction (admin-only authoring picker).
 * Bounded to the most-used terms across non-private entries so the filter
 * dropdown stays a plain <Select>, no search-as-you-type needed.
 */
const fetchFilterableTaxonomyTerms = async () => {
  "use cache";
  cacheLife("hours");
  cacheTag("taxonomy-filter-options");

  return await db
    .select({
      id: taxonomyTerm.publicId,
      label: taxonomyTerm.name,
    })
    .from(workTaxonomyEffective)
    .innerJoin(
      taxonomyTerm,
      eq(taxonomyTerm.id, workTaxonomyEffective.taxonomyTermId)
    )
    .innerJoin(work, eq(work.id, workTaxonomyEffective.workId))
    .innerJoin(libraryEntry, eq(libraryEntry.workId, work.id))
    .where(eq(libraryEntry.private, false))
    .groupBy(taxonomyTerm.id, taxonomyTerm.publicId, taxonomyTerm.name)
    .orderBy(sql`count(distinct ${work.id}) desc`, taxonomyTerm.name)
    .limit(MAX_FILTERABLE_TERMS);
};

export const getFilterableTaxonomyTerms = cache(fetchFilterableTaxonomyTerms);
