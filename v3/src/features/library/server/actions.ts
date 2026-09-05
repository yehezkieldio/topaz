"use server";

import { eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { requireAdmin } from "@/server/auth/require-admin";
import { recordAudit } from "@/server/db/audit";
import { db } from "@/server/db/client";
import { libraryEntry, readingEvent, readingState } from "@/server/db/schema";
import type { MutationResult } from "@/server/query/mutation-result";

import {
  libraryEntryTag,
  libraryListTag,
  libraryStatsTag,
  readingStateTag,
} from "./cache-tags";
import { toReadingEvent } from "./reading-events";

type LibraryEntryStatus = (typeof libraryEntry.status.enumValues)[number];

export const toggleFavoriteAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number
): Promise<MutationResult<{ favorite: boolean; version: number }>> => {
  const session = await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        favorite: libraryEntry.favorite,
        id: libraryEntry.id,
        status: libraryEntry.status,
        version: libraryEntry.version,
      })
      .from(libraryEntry)
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .limit(1);

    if (!current) {
      return { status: "not-found" as const };
    }
    if (current.version !== expectedVersion) {
      return {
        currentVersion: current.version,
        status: "version-conflict" as const,
      };
    }

    const [updated] = await tx
      .update(libraryEntry)
      .set({ favorite: !current.favorite, version: current.version + 1 })
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .returning({
        favorite: libraryEntry.favorite,
        version: libraryEntry.version,
      });

    const plan = toReadingEvent({
      from: { favorite: current.favorite, status: current.status },
      kind: "favorite",
      to: { favorite: updated?.favorite, status: current.status },
    });

    if (plan) {
      await tx.insert(readingEvent).values({
        eventType: plan.eventType,
        fromSnapshot: plan.fromSnapshot,
        libraryEntryId: current.id,
        metadata: { action: "toggle-favorite", actorId: session.user.id },
        toSnapshot: plan.toSnapshot,
      });
      await recordAudit(
        tx,
        { action: "toggle-favorite", actorId: session.user.id },
        {
          after: { favorite: updated?.favorite ?? null },
          before: { favorite: current.favorite },
          changedColumns: ["favorite"],
          entityId: current.id,
          entityType: "library_entry",
          version: updated?.version ?? current.version + 1,
        }
      );
    }

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(libraryEntryTag(libraryEntryPublicId), "max");
    revalidateTag(libraryStatsTag, "max");
    revalidateTag(libraryListTag, "max");
  }

  return result;
};

export const toggleFeaturedAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number
): Promise<
  MutationResult<{
    isFeatured: boolean;
    displayOrder: number | null;
    version: number;
  }>
> => {
  const session = await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: libraryEntry.id,
        isFeatured: libraryEntry.isFeatured,
        version: libraryEntry.version,
      })
      .from(libraryEntry)
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .limit(1);

    if (!current) {
      return { status: "not-found" as const };
    }
    if (current.version !== expectedVersion) {
      return {
        currentVersion: current.version,
        status: "version-conflict" as const,
      };
    }

    const nextFeatured = !current.isFeatured;
    let nextDisplayOrder: number | null = null;

    if (nextFeatured) {
      const [{ maxOrder }] = await tx
        .select({
          maxOrder: sql<number | null>`max(${libraryEntry.displayOrder})`,
        })
        .from(libraryEntry)
        .where(eq(libraryEntry.isFeatured, true));
      nextDisplayOrder = (maxOrder ?? -1) + 1;
    }

    const [updated] = await tx
      .update(libraryEntry)
      .set({
        displayOrder: nextDisplayOrder,
        isFeatured: nextFeatured,
        version: current.version + 1,
      })
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .returning({
        displayOrder: libraryEntry.displayOrder,
        isFeatured: libraryEntry.isFeatured,
        version: libraryEntry.version,
      });

    await recordAudit(
      tx,
      { action: "toggle-featured", actorId: session.user.id },
      {
        after: { isFeatured: updated?.isFeatured ?? null },
        before: { isFeatured: current.isFeatured },
        changedColumns: ["is_featured"],
        entityId: current.id,
        entityType: "library_entry",
        version: updated?.version ?? current.version + 1,
      }
    );

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(libraryEntryTag(libraryEntryPublicId), "max");
    revalidateTag(libraryStatsTag, "max");
    revalidateTag(libraryListTag, "max");
  }

  return result;
};

export const updateStatusAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number,
  status: LibraryEntryStatus
): Promise<MutationResult<{ status: LibraryEntryStatus; version: number }>> => {
  const session = await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: libraryEntry.id,
        status: libraryEntry.status,
        version: libraryEntry.version,
      })
      .from(libraryEntry)
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .limit(1);

    if (!current) {
      return { status: "not-found" as const };
    }
    if (current.version !== expectedVersion) {
      return {
        currentVersion: current.version,
        status: "version-conflict" as const,
      };
    }

    const [[startedRow], [updated]] = await Promise.all([
      tx
        .select({ startedAt: readingState.startedAt })
        .from(readingState)
        .where(eq(readingState.libraryEntryId, current.id))
        .limit(1),
      tx
        .update(libraryEntry)
        .set({ status, version: current.version + 1 })
        .where(eq(libraryEntry.publicId, libraryEntryPublicId))
        .returning({
          status: libraryEntry.status,
          version: libraryEntry.version,
        }),
    ]);

    const plan = toReadingEvent({
      from: { status: current.status },
      hasStartedBefore: Boolean(startedRow?.startedAt),
      kind: "status",
      to: { status: updated?.status },
    });

    if (plan) {
      await tx.insert(readingEvent).values({
        eventType: plan.eventType,
        fromSnapshot: plan.fromSnapshot,
        libraryEntryId: current.id,
        metadata: { action: "update-status", actorId: session.user.id },
        toSnapshot: plan.toSnapshot,
      });
      await recordAudit(
        tx,
        { action: "update-status", actorId: session.user.id },
        {
          after: { status: updated?.status ?? null },
          before: { status: current.status },
          changedColumns: ["status"],
          entityId: current.id,
          entityType: "library_entry",
          version: updated?.version ?? current.version + 1,
        }
      );
    }

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(libraryEntryTag(libraryEntryPublicId), "max");
    revalidateTag(libraryStatsTag, "max");
    revalidateTag(libraryListTag, "max");
  }

  return result;
};

export const updateRatingAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number,
  rating: number | null
): Promise<MutationResult<{ rating: number | null; version: number }>> => {
  const session = await requireAdmin();

  if (
    rating !== null &&
    (rating < 1 || rating > 10 || Math.round(rating * 2) !== rating * 2)
  ) {
    return {
      fieldErrors: {
        rating: ["Rating must be between 1 and 10, in half-point steps."],
      },
      status: "validation-error" as const,
    };
  }

  const result = await db.transaction(async (tx) => {
    const [entry] = await tx
      .select({ id: libraryEntry.id })
      .from(libraryEntry)
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .limit(1);

    if (!entry) {
      return { status: "not-found" as const };
    }

    const [current] = await tx
      .select({ rating: readingState.rating, version: readingState.version })
      .from(readingState)
      .where(eq(readingState.libraryEntryId, entry.id))
      .limit(1);

    const currentVersion = current?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      return {
        currentVersion,
        status: "version-conflict" as const,
      };
    }

    const [updated] = current
      ? await tx
          .update(readingState)
          .set({ rating, version: currentVersion + 1 })
          .where(eq(readingState.libraryEntryId, entry.id))
          .returning({
            rating: readingState.rating,
            version: readingState.version,
          })
      : await tx
          .insert(readingState)
          .values({ libraryEntryId: entry.id, rating, version: 1 })
          .returning({
            rating: readingState.rating,
            version: readingState.version,
          });

    const plan = toReadingEvent({
      from: { rating: current?.rating ?? null },
      kind: "rating",
      to: { rating: updated?.rating ?? null },
    });

    if (plan) {
      await tx.insert(readingEvent).values({
        eventType: plan.eventType,
        fromSnapshot: plan.fromSnapshot,
        libraryEntryId: entry.id,
        metadata: { action: "update-rating", actorId: session.user.id },
        toSnapshot: plan.toSnapshot,
      });
      await recordAudit(
        tx,
        { action: "update-rating", actorId: session.user.id },
        {
          after: { rating: updated?.rating ?? null },
          before: { rating: current?.rating ?? null },
          changedColumns: ["rating"],
          entityId: entry.id,
          entityType: "library_entry",
          version: updated?.version ?? currentVersion + 1,
        }
      );
    }

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(readingStateTag(libraryEntryPublicId), "max");
    revalidateTag(libraryStatsTag, "max");
    revalidateTag(libraryListTag, "max");
  }

  return result;
};

export const updateProgressAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number,
  currentChapter: number | null
): Promise<
  MutationResult<{ currentChapter: number | null; version: number }>
> => {
  const session = await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [entry] = await tx
      .select({ id: libraryEntry.id })
      .from(libraryEntry)
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .limit(1);

    if (!entry) {
      return { status: "not-found" as const };
    }

    const [current] = await tx
      .select({
        currentChapter: readingState.currentChapter,
        startedAt: readingState.startedAt,
        version: readingState.version,
      })
      .from(readingState)
      .where(eq(readingState.libraryEntryId, entry.id))
      .limit(1);

    const currentVersion = current?.version ?? 0;
    if (currentVersion !== expectedVersion) {
      return {
        currentVersion,
        status: "version-conflict" as const,
      };
    }

    const now = new Date();
    const startedAt = current?.startedAt ?? now;

    const [updated] = current
      ? await tx
          .update(readingState)
          .set({
            currentChapter,
            lastReadAt: now,
            startedAt,
            version: currentVersion + 1,
          })
          .where(eq(readingState.libraryEntryId, entry.id))
          .returning({
            currentChapter: readingState.currentChapter,
            version: readingState.version,
          })
      : await tx
          .insert(readingState)
          .values({
            currentChapter,
            lastReadAt: now,
            libraryEntryId: entry.id,
            startedAt,
            version: 1,
          })
          .returning({
            currentChapter: readingState.currentChapter,
            version: readingState.version,
          });

    const plan = toReadingEvent({
      from: { currentChapter: current?.currentChapter ?? null },
      kind: "progress",
      to: { currentChapter: updated?.currentChapter ?? null },
    });

    if (plan) {
      await tx.insert(readingEvent).values({
        eventType: plan.eventType,
        fromSnapshot: plan.fromSnapshot,
        libraryEntryId: entry.id,
        metadata: { action: "update-progress", actorId: session.user.id },
        toSnapshot: plan.toSnapshot,
      });
      await recordAudit(
        tx,
        { action: "update-progress", actorId: session.user.id },
        {
          after: { currentChapter: updated?.currentChapter ?? null },
          before: { currentChapter: current?.currentChapter ?? null },
          changedColumns: ["current_chapter"],
          entityId: entry.id,
          entityType: "library_entry",
          version: updated?.version ?? currentVersion + 1,
        }
      );
    }

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(readingStateTag(libraryEntryPublicId), "max");
    revalidateTag(libraryStatsTag, "max");
    revalidateTag(libraryListTag, "max");
  }

  return result;
};
