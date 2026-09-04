import "server-only";
import { eq, or } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import {
  taxonomyRelation,
  work,
  workTaxonomyAssignment,
} from "@/server/db/schema";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];
type RelationType = (typeof taxonomyRelation.relationType.enumValues)[number];

export const listRelationsForTerm = async (tx: Tx, termId: string) =>
  await tx
    .select({
      fromTermId: taxonomyRelation.fromTermId,
      id: taxonomyRelation.publicId,
      relationType: taxonomyRelation.relationType,
      toTermId: taxonomyRelation.toTermId,
    })
    .from(taxonomyRelation)
    .where(
      or(
        eq(taxonomyRelation.fromTermId, termId),
        eq(taxonomyRelation.toTermId, termId)
      )
    );

export const insertRelation = async (
  tx: Tx,
  fromTermId: string,
  toTermId: string,
  relationType: RelationType
) =>
  await tx
    .insert(taxonomyRelation)
    .values({ fromTermId, relationType, toTermId })
    .onConflictDoNothing()
    .returning({ id: taxonomyRelation.publicId });

export const deleteRelation = async (tx: Tx, relationPublicId: string) =>
  await tx
    .delete(taxonomyRelation)
    .where(eq(taxonomyRelation.publicId, relationPublicId))
    .returning({
      fromTermId: taxonomyRelation.fromTermId,
      toTermId: taxonomyRelation.toTermId,
    });

/**
 * Every work id whose effective taxonomy could change if this term's direct
 * assignments or relation edges change -- used to know which works to
 * rebuild after a relation add/delete/merge (a relation change can affect
 * inferred rows on works that never directly reference the changed term).
 */
export const findWorkIdsAssignedToTerm = async (tx: Tx, termId: string) => {
  const rows = await tx
    .select({ workId: workTaxonomyAssignment.workId })
    .from(workTaxonomyAssignment)
    .where(eq(workTaxonomyAssignment.taxonomyTermId, termId));
  return rows.map((row) => row.workId);
};

export const findWorkPublicId = async (tx: Tx, workId: string) => {
  const [row] = await tx
    .select({ publicId: work.publicId })
    .from(work)
    .where(eq(work.id, workId))
    .limit(1);
  return row?.publicId;
};
