import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";

import type { db as dbClient } from "@/server/db/client";
import { taxonomyLabel } from "@/server/db/schema";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];

export interface LabelRow {
  id: string;
  label: string;
  isPrimary: boolean;
}

export const listLabelsForTerm = async (
  tx: Tx,
  termId: string
): Promise<LabelRow[]> =>
  await tx
    .select({
      id: taxonomyLabel.publicId,
      isPrimary: taxonomyLabel.isPrimary,
      label: taxonomyLabel.label,
    })
    .from(taxonomyLabel)
    .where(eq(taxonomyLabel.taxonomyTermId, termId))
    .orderBy(desc(taxonomyLabel.isPrimary), asc(taxonomyLabel.label));

export const insertLabel = async (
  tx: Tx,
  termId: string,
  label: string,
  isPrimary: boolean
) =>
  await tx
    .insert(taxonomyLabel)
    .values({ isPrimary, label, taxonomyTermId: termId })
    .returning({
      id: taxonomyLabel.publicId,
      isPrimary: taxonomyLabel.isPrimary,
      label: taxonomyLabel.label,
    });

export const findLabelByPublicId = async (tx: Tx, labelPublicId: string) => {
  const [row] = await tx
    .select({
      id: taxonomyLabel.id,
      publicId: taxonomyLabel.publicId,
      taxonomyTermId: taxonomyLabel.taxonomyTermId,
    })
    .from(taxonomyLabel)
    .where(eq(taxonomyLabel.publicId, labelPublicId))
    .limit(1);
  return row;
};

export const deleteLabel = async (tx: Tx, labelId: string) =>
  await tx
    .delete(taxonomyLabel)
    .where(eq(taxonomyLabel.id, labelId))
    .returning({ id: taxonomyLabel.publicId });

/**
 * Two-step swap, not a single UPDATE ... WHERE id in (old, new) -- the
 * partial unique index (taxonomy_label_term_primary_uidx) allows at most one
 * `is_primary = true` row per term, so the old primary must be cleared
 * before the new one can be set inside the same transaction.
 */
export const setPrimaryLabel = async (
  tx: Tx,
  termId: string,
  labelId: string
) => {
  await tx
    .update(taxonomyLabel)
    .set({ isPrimary: false })
    .where(
      and(
        eq(taxonomyLabel.taxonomyTermId, termId),
        eq(taxonomyLabel.isPrimary, true)
      )
    );
  return await tx
    .update(taxonomyLabel)
    .set({ isPrimary: true })
    .where(eq(taxonomyLabel.id, labelId))
    .returning({
      id: taxonomyLabel.publicId,
      isPrimary: taxonomyLabel.isPrimary,
      label: taxonomyLabel.label,
    });
};
