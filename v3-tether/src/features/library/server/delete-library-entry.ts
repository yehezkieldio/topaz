import "server-only";
import { and, eq } from "drizzle-orm";

import { recordAudit } from "@/server/db/audit";
import type { db as dbClient } from "@/server/db/client";
import { libraryEntry, readingState } from "@/server/db/schema";

type Tx = Parameters<Parameters<typeof dbClient.transaction>[0]>[0];

/**
 * Soft-deletes one library_entry row by internal id (not publicId), and its
 * reading_state row when one exists -- the shared core of both
 * deleteLibraryEntryAction's admin-initiated, version-checked delete
 * (actions.ts) and deleteWorkAction's cascade (update-work-action.ts),
 * which has no separate expectedVersion from the UI to check since
 * deleting the work is itself the authoritative action, not a second edit
 * of the library_entry the admin confirmed independently.
 *
 * Two separate recordAudit calls, not one: library_entry and reading_state
 * are two different physical tables with two different row ids, so each
 * needs its own oplog tombstone row to relay correctly to a peer (same
 * reasoning as updateRatingAction/updateProgressAction's oplog override in
 * actions.ts) -- the reading_state one just also uses `after: null` to
 * mark it, but must still be framed under entityType "library_entry" since
 * "reading_state" isn't itself a valid audit entity type
 * (schema/audit.ts's auditEntityTypeValues).
 */
export const softDeleteLibraryEntry = async (
  tx: Tx,
  actorId: string,
  libraryEntryId: string,
  currentVersion: number
): Promise<void> => {
  const nextVersion = currentVersion + 1;

  await tx
    .update(libraryEntry)
    .set({ deleted: true, version: nextVersion })
    .where(eq(libraryEntry.id, libraryEntryId));

  await recordAudit(
    tx,
    { action: "delete-library-entry", actorId },
    {
      after: null,
      before: { deleted: false },
      changedColumns: ["deleted"],
      entityId: libraryEntryId,
      entityType: "library_entry",
      version: nextVersion,
    }
  );

  const [existingReadingState] = await tx
    .select({ version: readingState.version })
    .from(readingState)
    .where(
      and(
        eq(readingState.libraryEntryId, libraryEntryId),
        eq(readingState.deleted, false)
      )
    )
    .limit(1);

  if (!existingReadingState) {
    return;
  }

  const nextReadingStateVersion = existingReadingState.version + 1;

  await tx
    .update(readingState)
    .set({ deleted: true, version: nextReadingStateVersion })
    .where(eq(readingState.libraryEntryId, libraryEntryId));

  await recordAudit(
    tx,
    { action: "delete-library-entry", actorId },
    {
      after: null,
      before: { deleted: false },
      changedColumns: ["deleted"],
      entityId: libraryEntryId,
      entityType: "library_entry",
      oplog: {
        columnDiffs: {},
        rowId: libraryEntryId,
        tableName: "reading_state",
        tombstone: true,
      },
      version: nextReadingStateVersion,
    }
  );
};
