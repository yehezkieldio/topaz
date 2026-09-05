import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import {
  taxonomyRelation,
  taxonomyTerm,
  workTaxonomyAssignment,
} from "@/server/db/schema";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];

/**
 * Reassigns every `work_taxonomy_assignment` row from the losing term to the
 * winning term (skipping a work that already has the winner assigned, so the
 * composite PK never collides), reassigns relation edges the same way, marks
 * the loser `status: "merged"` with `mergedIntoId`, and returns every work id
 * whose effective taxonomy now needs a rebuild.
 */
export const mergeTerms = async (
  tx: Tx,
  winningTermId: string,
  losingTermId: string
): Promise<string[]> => {
  const [losingAssignments, winningAssignments] = await Promise.all([
    tx
      .select({ workId: workTaxonomyAssignment.workId })
      .from(workTaxonomyAssignment)
      .where(eq(workTaxonomyAssignment.taxonomyTermId, losingTermId)),
    tx
      .select({ workId: workTaxonomyAssignment.workId })
      .from(workTaxonomyAssignment)
      .where(eq(workTaxonomyAssignment.taxonomyTermId, winningTermId)),
  ]);

  const alreadyOnWinner = new Set(winningAssignments.map((row) => row.workId));
  const workIdsToReassign = losingAssignments
    .map((row) => row.workId)
    .filter((workId) => !alreadyOnWinner.has(workId));

  if (workIdsToReassign.length > 0) {
    await tx
      .update(workTaxonomyAssignment)
      .set({ taxonomyTermId: winningTermId })
      .where(
        and(
          eq(workTaxonomyAssignment.taxonomyTermId, losingTermId),
          inArray(workTaxonomyAssignment.workId, workIdsToReassign)
        )
      );
  }

  // Any assignment rows still pointing at the loser belong to works that
  // already had the winner assigned -- reassigning would violate the
  // composite PK, so these are just redundant and get dropped instead.
  await tx
    .delete(workTaxonomyAssignment)
    .where(eq(workTaxonomyAssignment.taxonomyTermId, losingTermId));

  // A relation directly between the winner and the loser becomes a
  // self-edge once the loser is folded in -- drop it first so the
  // reassignment below never violates the no-self-edge check constraint.
  await tx
    .delete(taxonomyRelation)
    .where(
      or(
        and(
          eq(taxonomyRelation.fromTermId, losingTermId),
          eq(taxonomyRelation.toTermId, winningTermId)
        ),
        and(
          eq(taxonomyRelation.fromTermId, winningTermId),
          eq(taxonomyRelation.toTermId, losingTermId)
        )
      )
    );

  // Reassign edge-by-edge via delete + insert-if-not-duplicate rather than a
  // bulk UPDATE, since a bulk update could collide with the
  // (fromTermId, toTermId, relationType) unique index if the winner already
  // has the equivalent edge.
  const outgoing = await tx
    .delete(taxonomyRelation)
    .where(eq(taxonomyRelation.fromTermId, losingTermId))
    .returning({
      relationType: taxonomyRelation.relationType,
      toTermId: taxonomyRelation.toTermId,
    });
  for (const edge of outgoing) {
    await tx
      .insert(taxonomyRelation)
      .values({
        fromTermId: winningTermId,
        relationType: edge.relationType,
        toTermId: edge.toTermId,
      })
      .onConflictDoNothing();
  }

  const incoming = await tx
    .delete(taxonomyRelation)
    .where(eq(taxonomyRelation.toTermId, losingTermId))
    .returning({
      fromTermId: taxonomyRelation.fromTermId,
      relationType: taxonomyRelation.relationType,
    });
  for (const edge of incoming) {
    await tx
      .insert(taxonomyRelation)
      .values({
        fromTermId: edge.fromTermId,
        relationType: edge.relationType,
        toTermId: winningTermId,
      })
      .onConflictDoNothing();
  }

  await tx
    .update(taxonomyTerm)
    .set({ mergedIntoId: winningTermId, status: "merged" })
    .where(eq(taxonomyTerm.id, losingTermId));

  const affectedWorkIds = new Set([
    ...workIdsToReassign,
    ...winningAssignments.map((row) => row.workId),
  ]);

  return [...affectedWorkIds];
};
