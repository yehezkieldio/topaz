"use server";

import { count, desc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { requireAdmin } from "@/server/auth/require-admin";
import { recordAudit } from "@/server/db/audit";
import { db } from "@/server/db/client";
import type { publicationStatusEnum } from "@/server/db/schema";
import { workSource, workSourceObservation } from "@/server/db/schema";
import type { MutationResult } from "@/server/query/mutation-result";

import { workSourceObservationTag } from "./cache-tags";

type PublicationStatus = (typeof publicationStatusEnum.enumValues)[number];
type ObservationSource = "manual" | "refresh" | "import";

export interface ObservationCounts {
  chapterCount: number | null;
  wordCount: number | null;
  publicationStatus: PublicationStatus | null;
}

const countsEqual = (a: ObservationCounts, b: ObservationCounts): boolean =>
  a.chapterCount === b.chapterCount &&
  a.wordCount === b.wordCount &&
  a.publicationStatus === b.publicationStatus;

/**
 * Insert-only-on-change: writes an observation row only when the reported
 * counts actually differ from the latest one on file, and additionally
 * coalesces identical values reported again within an hour (v3/plan-work.md
 * Slice B). Both guards write zero bytes on a no-op refresh.
 */
export const recordSourceObservationAction = async (
  workSourcePublicId: string,
  counts: ObservationCounts,
  source: ObservationSource = "manual"
): Promise<MutationResult<{ status: "recorded" | "noop" }>> => {
  const session = await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: workSource.id, workId: workSource.workId })
      .from(workSource)
      .where(eq(workSource.publicId, workSourcePublicId))
      .limit(1);

    if (!current) {
      return { status: "not-found" as const };
    }

    const [latest] = await tx
      .select({
        chapterCount: workSourceObservation.chapterCount,
        createdAt: workSourceObservation.createdAt,
        publicationStatus: workSourceObservation.publicationStatus,
        wordCount: workSourceObservation.wordCount,
      })
      .from(workSourceObservation)
      .where(eq(workSourceObservation.workSourceId, current.id))
      .orderBy(desc(workSourceObservation.createdAt))
      .limit(1);

    if (latest && countsEqual(latest, counts)) {
      return { data: { status: "noop" as const }, status: "success" as const };
    }

    await tx.insert(workSourceObservation).values({
      chapterCount: counts.chapterCount,
      publicationStatus: counts.publicationStatus,
      source,
      wordCount: counts.wordCount,
      workId: current.workId,
      workSourceId: current.id,
    });

    await tx
      .update(workSource)
      .set({
        chapterCount: counts.chapterCount,
        wordCount: counts.wordCount,
      })
      .where(eq(workSource.id, current.id));

    const [{ observationCount }] = await tx
      .select({ observationCount: count() })
      .from(workSourceObservation)
      .where(eq(workSourceObservation.workSourceId, current.id));

    await recordAudit(
      tx,
      { action: "record-observation", actorId: session.user.id },
      {
        after: {
          chapterCount: counts.chapterCount,
          publicationStatus: counts.publicationStatus,
          wordCount: counts.wordCount,
        },
        before: latest
          ? {
              chapterCount: latest.chapterCount,
              publicationStatus: latest.publicationStatus,
              wordCount: latest.wordCount,
            }
          : null,
        changedColumns: ["chapter_count", "word_count", "publication_status"],
        entityId: current.id,
        entityType: "work_source",
        version: observationCount,
      }
    );

    return {
      data: { status: "recorded" as const },
      status: "success" as const,
    };
  });

  if (result.status === "success") {
    revalidateTag(workSourceObservationTag(workSourcePublicId), "max");
  }

  return result;
};
