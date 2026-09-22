import { and, asc, eq } from "drizzle-orm";

import type { db } from "./client";
import { contributor, work, workContributor, workSource } from "./schema";

// Widened to accept the plain client too, not just an in-flight transaction
// -- src/server/sync/apply.ts's own Tx type carries the same union, since
// its callers aren't always wrapped in a transaction, and this function is
// called from inside that file's applyToTable/applyTombstoneToTable.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

/**
 * Recomputes and writes `work.primarySourceId` / `work.primaryAuthorId` --
 * the denormalized "earliest source" / "first author" pointers that
 * features/library/server/queries.ts's fetchLibraryList reads directly
 * instead of re-deriving them via a row_number()-over-partition scan of the
 * entire work_source / work_contributor tables on every cache-miss list
 * fetch. Must be called, inside the same transaction, after every write that
 * can change which work_source or work_contributor row is "first" for a
 * work: create, update, soft-delete, or a sync-applied upsert/tombstone.
 *
 * Deliberately a full re-derivation, not an incremental patch -- "is this
 * write the new earliest/first" is exactly as cheap to answer by re-running
 * the two indexed lookups below (work_source_work_id_idx,
 * work_contributor_contributor_id_idx's sibling on work_id) as it would be
 * to special-case every caller's write shape, and re-derivation can never
 * drift from the selection rule below since there is only one place it's
 * expressed.
 */
export const recomputeWorkPrimaryPointers = async (
  tx: Tx,
  workId: string
): Promise<void> => {
  const [primarySource] = await tx
    .select({ id: workSource.id })
    .from(workSource)
    .where(and(eq(workSource.workId, workId), eq(workSource.deleted, false)))
    .orderBy(asc(workSource.createdAt))
    .limit(1);

  const [primaryAuthor] = await tx
    .select({ id: contributor.id })
    .from(workContributor)
    .innerJoin(contributor, eq(contributor.id, workContributor.contributorId))
    .where(
      and(
        eq(workContributor.workId, workId),
        eq(workContributor.role, "author")
      )
    )
    .orderBy(asc(contributor.name))
    .limit(1);

  await tx
    .update(work)
    .set({
      primaryAuthorId: primaryAuthor?.id ?? null,
      primarySourceId: primarySource?.id ?? null,
    })
    .where(eq(work.id, workId));
};
