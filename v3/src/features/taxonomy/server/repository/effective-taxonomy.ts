import "server-only";
import { and, eq, inArray } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import {
  taxonomyRelation,
  workTaxonomyAssignment,
  workTaxonomyEffective,
} from "@/server/db/schema";

const MAX_DEPTH = 4;

/**
 * Relation types that propagate a work's effective taxonomy transitively --
 * "a work tagged with a narrower term is also effectively tagged with
 * everything it's broader-than/implies/equivalent-to". `related` and
 * `conflicts_with` are associative/exclusionary, not hierarchical, so they
 * never contribute an inferred assignment.
 */
const PROPAGATING_RELATION_TYPES = [
  "broader",
  "implies",
  "equivalent_to",
] as const;

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];

/**
 * Rebuilds `work_taxonomy_effective` for one work: direct assignments at
 * depth 0 (reason "direct"), then a bounded BFS over propagating relation
 * types up to `MAX_DEPTH` (reason "inferred"). Replace-in-place inside the
 * caller's transaction -- called from every Server Action that changes an
 * assignment or a relation, per 06_library/05_taxonomy_in_sheets.md.
 */
export const rebuildEffectiveTaxonomyForWork = async (
  tx: Tx,
  workId: string
): Promise<void> => {
  const direct = await tx
    .select({ taxonomyTermId: workTaxonomyAssignment.taxonomyTermId })
    .from(workTaxonomyAssignment)
    .where(eq(workTaxonomyAssignment.workId, workId));

  const effective = new Map<
    string,
    { depth: number; reason: "direct" | "inferred" }
  >();
  for (const row of direct) {
    effective.set(row.taxonomyTermId, { depth: 0, reason: "direct" });
  }

  let frontier = [...effective.keys()];
  for (let depth = 1; depth <= MAX_DEPTH && frontier.length > 0; depth += 1) {
    const edges = await tx
      .select({
        fromTermId: taxonomyRelation.fromTermId,
        toTermId: taxonomyRelation.toTermId,
      })
      .from(taxonomyRelation)
      .where(
        and(
          inArray(taxonomyRelation.fromTermId, frontier),
          inArray(taxonomyRelation.relationType, [
            ...PROPAGATING_RELATION_TYPES,
          ])
        )
      );

    const nextFrontier: string[] = [];
    for (const edge of edges) {
      if (!effective.has(edge.toTermId)) {
        effective.set(edge.toTermId, { depth, reason: "inferred" });
        nextFrontier.push(edge.toTermId);
      }
    }
    frontier = nextFrontier;
  }

  await tx
    .delete(workTaxonomyEffective)
    .where(eq(workTaxonomyEffective.workId, workId));

  const rows = [...effective.entries()].map(([taxonomyTermId, meta]) => ({
    depth: meta.depth,
    reason: meta.reason,
    taxonomyTermId,
    workId,
  }));

  if (rows.length > 0) {
    await tx.insert(workTaxonomyEffective).values(rows);
  }
};
