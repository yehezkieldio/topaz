import "server-only";
import { and, inArray } from "drizzle-orm";

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

interface EffectiveEntry {
  depth: number;
  reason: "direct" | "inferred";
}
type EffectiveMap = Map<string, EffectiveEntry>;

/**
 * Rebuilds `work_taxonomy_effective` for every work in `workIds` at once:
 * one query for all direct assignments, then a bounded BFS where each depth
 * level is *one shared edge query* across every work's frontier (not one
 * query per work per depth) -- so a merge/relation-change affecting N works
 * costs O(MAX_DEPTH) round trips total, not O(N * MAX_DEPTH)
 * (topaz-v3-specs/07_backend/01_query_and_n_plus_one_policy.md). Replace-
 * in-place inside the caller's transaction for every affected work in one
 * delete + one insert.
 */
export const rebuildEffectiveTaxonomyForWorks = async (
  tx: Tx,
  workIds: string[]
): Promise<void> => {
  if (workIds.length === 0) {
    return;
  }

  const direct = await tx
    .select({
      taxonomyTermId: workTaxonomyAssignment.taxonomyTermId,
      workId: workTaxonomyAssignment.workId,
    })
    .from(workTaxonomyAssignment)
    .where(inArray(workTaxonomyAssignment.workId, workIds));

  const effectiveByWork = new Map<string, EffectiveMap>(
    workIds.map((workId) => [workId, new Map()])
  );
  for (const row of direct) {
    effectiveByWork
      .get(row.workId)
      ?.set(row.taxonomyTermId, { depth: 0, reason: "direct" });
  }

  let frontierByWork = new Map<string, string[]>(
    workIds.map((workId) => [
      workId,
      [...(effectiveByWork.get(workId)?.keys() ?? [])],
    ])
  );

  for (let depth = 1; depth <= MAX_DEPTH; depth += 1) {
    const allFrontierTermIds = [
      ...new Set([...frontierByWork.values()].flat()),
    ];
    if (allFrontierTermIds.length === 0) {
      break;
    }

    const edges = await tx
      .select({
        fromTermId: taxonomyRelation.fromTermId,
        toTermId: taxonomyRelation.toTermId,
      })
      .from(taxonomyRelation)
      .where(
        and(
          inArray(taxonomyRelation.fromTermId, allFrontierTermIds),
          inArray(taxonomyRelation.relationType, [
            ...PROPAGATING_RELATION_TYPES,
          ])
        )
      );

    const toTermsByFromTerm = new Map<string, string[]>();
    for (const edge of edges) {
      const bucket = toTermsByFromTerm.get(edge.fromTermId) ?? [];
      bucket.push(edge.toTermId);
      toTermsByFromTerm.set(edge.fromTermId, bucket);
    }

    const nextFrontierByWork = new Map<string, string[]>();
    for (const workId of workIds) {
      const effective = effectiveByWork.get(workId);
      if (!effective) {
        continue;
      }
      const nextFrontier: string[] = [];
      for (const fromTermId of frontierByWork.get(workId) ?? []) {
        for (const toTermId of toTermsByFromTerm.get(fromTermId) ?? []) {
          if (!effective.has(toTermId)) {
            effective.set(toTermId, { depth, reason: "inferred" });
            nextFrontier.push(toTermId);
          }
        }
      }
      nextFrontierByWork.set(workId, nextFrontier);
    }
    frontierByWork = nextFrontierByWork;
  }

  await tx
    .delete(workTaxonomyEffective)
    .where(inArray(workTaxonomyEffective.workId, workIds));

  const rows = [...effectiveByWork.entries()].flatMap(([workId, effective]) =>
    [...effective.entries()].map(([taxonomyTermId, meta]) => ({
      depth: meta.depth,
      reason: meta.reason,
      taxonomyTermId,
      workId,
    }))
  );

  if (rows.length > 0) {
    await tx.insert(workTaxonomyEffective).values(rows);
  }
};

/** Single-work convenience wrapper over rebuildEffectiveTaxonomyForWorks. */
export const rebuildEffectiveTaxonomyForWork = async (
  tx: Tx,
  workId: string
): Promise<void> => {
  await rebuildEffectiveTaxonomyForWorks(tx, [workId]);
};
