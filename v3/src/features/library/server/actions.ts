"use server";

import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db/client";
import { libraryEntry, readingState } from "@/server/db/schema";
import type { MutationResult } from "@/server/query/mutation-result";

import { libraryEntryTag, readingStateTag } from "./cache-tags";

type LibraryEntryStatus = (typeof libraryEntry.status.enumValues)[number];

export const toggleFavoriteAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number
): Promise<MutationResult<{ favorite: boolean; version: number }>> => {
  await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        favorite: libraryEntry.favorite,
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

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(libraryEntryTag(libraryEntryPublicId), "max");
  }

  return result;
};

export const updateStatusAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number,
  status: LibraryEntryStatus
): Promise<MutationResult<{ status: LibraryEntryStatus; version: number }>> => {
  await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ version: libraryEntry.version })
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
      .set({ status, version: current.version + 1 })
      .where(eq(libraryEntry.publicId, libraryEntryPublicId))
      .returning({
        status: libraryEntry.status,
        version: libraryEntry.version,
      });

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(libraryEntryTag(libraryEntryPublicId), "max");
  }

  return result;
};

export const updateRatingAction = async (
  libraryEntryPublicId: string,
  expectedVersion: number,
  rating: number | null
): Promise<MutationResult<{ rating: number | null; version: number }>> => {
  await requireAdmin();

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
      .select({ version: readingState.version })
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

    return { data: updated, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(readingStateTag(libraryEntryPublicId), "max");
  }

  return result;
};
