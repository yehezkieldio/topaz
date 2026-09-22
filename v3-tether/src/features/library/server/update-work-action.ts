"use server";

import {
  createServerValidate,
  ServerValidateError,
} from "@tanstack/react-form-nextjs";
import type { ServerFormState } from "@tanstack/react-form-nextjs";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import {
  deriveSortTitle,
  normalizeRawWorkFormData,
  workFormOpts,
  workFormSchema,
} from "@/features/library/forms/work-form/shared-code";
import type { WorkFormValues } from "@/features/library/forms/work-form/shared-code";
import { workTaxonomyEffectiveTag } from "@/features/taxonomy/server/cache-tags";
import { rebuildEffectiveTaxonomyForWork } from "@/features/taxonomy/server/repository/effective-taxonomy";
import { requireAdmin } from "@/server/auth/require-admin";
import { recordAudit } from "@/server/db/audit";
import { db } from "@/server/db/client";
import {
  contributor,
  libraryEntry,
  readingState,
  sourcePlatform,
  taxonomyTerm,
  work,
  workContributor,
  workSource,
  workSourceObservation,
  workTaxonomyAssignment,
} from "@/server/db/schema";
import type { MutationResult } from "@/server/query/mutation-result";

import { libraryListTag, libraryStatsTag, workTag } from "./cache-tags";
import { softDeleteLibraryEntry } from "./delete-library-entry";
import { insertWorkFts, removeWorkFromFts } from "./work-fts";

const normalize = (value: string) => value.trim().toLowerCase();

export interface WorkEditDetail {
  workPublicId: string;
  version: number;
  title: string;
  description: string | null;
  contentRating: (typeof work.contentRating.enumValues)[number];
  publicationStatus: (typeof work.publicationStatus.enumValues)[number];
  isNsfw: boolean;
  authorName: string;
  sourcePlatformId: string;
  sourceUrl: string;
  workSourcePublicId: string | null;
  latestChapterCount: number | null;
  latestWordCount: number | null;
  latestPublicationStatus:
    | (typeof work.publicationStatus.enumValues)[number]
    | null;
  taxonomyTermIds: string[];
  taxonomyTermOptions: { id: string; label: string }[];
  libraryEntryPublicId: string;
  libraryEntryVersion: number;
  status: (typeof libraryEntry.status.enumValues)[number];
  rating: number | null;
  currentChapter: number | null;
  readingStateVersion: number | null;
}

/**
 * Feeds the edit sheet's initial form state. Admin-only, on-demand read
 * (not "use cache") -- called directly from a client component the moment
 * the sheet opens, not rendered as part of any cached list. Scoped by
 * libraryEntryPublicId (not just workPublicId) because the reading-progress
 * fields below -- status, rating, current chapter -- live on that entry, not
 * on the work itself.
 */
export const getWorkEditDetailAction = async (
  workPublicId: string,
  libraryEntryPublicId: string
): Promise<WorkEditDetail | null> => {
  await requireAdmin();

  const [workRow] = await db
    .select({
      contentRating: work.contentRating,
      description: work.description,
      id: work.id,
      isNsfw: work.isNsfw,
      publicationStatus: work.publicationStatus,
      title: work.title,
      version: work.version,
    })
    .from(work)
    .where(and(eq(work.publicId, workPublicId), eq(work.deleted, false)))
    .limit(1);

  if (!workRow) {
    return null;
  }

  const [entryRow] = await db
    .select({
      currentChapter: readingState.currentChapter,
      id: libraryEntry.id,
      rating: readingState.rating,
      readingStateVersion: readingState.version,
      status: libraryEntry.status,
      version: libraryEntry.version,
    })
    .from(libraryEntry)
    .leftJoin(readingState, eq(readingState.libraryEntryId, libraryEntry.id))
    .where(
      and(
        eq(libraryEntry.publicId, libraryEntryPublicId),
        eq(libraryEntry.deleted, false)
      )
    )
    .limit(1);

  if (!entryRow) {
    return null;
  }

  const [[sourceRow], [contributorRow], taxonomyRows] = await Promise.all([
    db
      .select({
        chapterCount: workSource.chapterCount,
        id: workSource.id,
        sourcePlatformId: sourcePlatform.publicId,
        sourceUrl: workSource.url,
        wordCount: workSource.wordCount,
        workSourcePublicId: workSource.publicId,
      })
      .from(workSource)
      .innerJoin(
        sourcePlatform,
        eq(sourcePlatform.id, workSource.sourcePlatformId)
      )
      .where(
        and(eq(workSource.workId, workRow.id), eq(workSource.deleted, false))
      )
      .orderBy(asc(workSource.createdAt))
      .limit(1),
    db
      .select({ name: contributor.name })
      .from(workContributor)
      .innerJoin(contributor, eq(contributor.id, workContributor.contributorId))
      .where(
        and(
          eq(workContributor.workId, workRow.id),
          eq(workContributor.role, "author")
        )
      )
      .limit(1),
    db
      .select({ id: taxonomyTerm.publicId, label: taxonomyTerm.name })
      .from(workTaxonomyAssignment)
      .innerJoin(
        taxonomyTerm,
        eq(taxonomyTerm.id, workTaxonomyAssignment.taxonomyTermId)
      )
      .where(eq(workTaxonomyAssignment.workId, workRow.id)),
  ]);

  const [latestObservation] = sourceRow
    ? await db
        .select({ publicationStatus: workSourceObservation.publicationStatus })
        .from(workSourceObservation)
        .where(eq(workSourceObservation.workSourceId, sourceRow.id))
        .orderBy(desc(workSourceObservation.createdAt))
        .limit(1)
    : [];

  return {
    authorName: contributorRow?.name ?? "",
    contentRating: workRow.contentRating,
    currentChapter: entryRow.currentChapter,
    description: workRow.description,
    isNsfw: workRow.isNsfw,
    latestChapterCount: sourceRow?.chapterCount ?? null,
    latestPublicationStatus: latestObservation?.publicationStatus ?? null,
    latestWordCount: sourceRow?.wordCount ?? null,
    libraryEntryPublicId,
    libraryEntryVersion: entryRow.version,
    publicationStatus: workRow.publicationStatus,
    rating: entryRow.rating,
    readingStateVersion: entryRow.readingStateVersion,
    sourcePlatformId: sourceRow?.sourcePlatformId ?? "",
    sourceUrl: sourceRow?.sourceUrl ?? "",
    status: entryRow.status,
    taxonomyTermIds: taxonomyRows.map((row) => row.id),
    taxonomyTermOptions: taxonomyRows,
    title: workRow.title,
    version: workRow.version,
    workPublicId,
    workSourcePublicId: sourceRow?.workSourcePublicId ?? null,
  };
};

const serverValidate = createServerValidate({
  ...workFormOpts,
  // See the matching comment in create-work-action.ts -- `{ fields }` isn't
  // a shape createServerValidate's onServerValidate decomposes; it just
  // renders as "[object Object]" wherever the error surfaces.
  onServerValidate: ({ value }) => {
    const result = workFormSchema.safeParse(normalizeRawWorkFormData(value));
    if (result.success) {
      return;
    }
    return result.error.issues
      .map((issue) => `${issue.path.join(".") || "form"}: ${issue.message}`)
      .join("; ");
  },
});

/**
 * Version-checked update of a work + its primary source, author, and direct
 * taxonomy assignments, all inside one transaction. Bound with
 * (workPublicId, expectedVersion) before being handed to useActionState, so
 * the resulting (previousState, formData) signature matches what a <form
 * action> / useActionState expects.
 */
export const updateWorkAction = async (
  workPublicId: string,
  expectedVersion: number,
  // Unused: only present because useActionState/<form action> call this with
  // (previousState, formData). Its real shape is whatever this action (or
  // initialFormState) last returned -- a ServerFormState<WorkFormValues>.
  _previousState: ServerFormState<WorkFormValues, undefined> | undefined,
  formData: FormData
) => {
  const session = await requireAdmin();

  let value: Awaited<ReturnType<typeof workFormSchema.parseAsync>>;
  try {
    const rawValue = await serverValidate(formData);
    value = workFormSchema.parse(normalizeRawWorkFormData(rawValue));
  } catch (error) {
    if (error instanceof ServerValidateError) {
      return error.formState;
    }
    throw error;
  }

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        contentRating: work.contentRating,
        id: work.id,
        publicationStatus: work.publicationStatus,
        title: work.title,
        version: work.version,
      })
      .from(work)
      .where(and(eq(work.publicId, workPublicId), eq(work.deleted, false)))
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

    // Must run before the update below, not after -- see
    // work-fts.ts's removeWorkFromFts doc.
    await removeWorkFromFts(tx, current.id);

    await tx
      .update(work)
      .set({
        contentRating: value.contentRating,
        description: value.description?.trim() || null,
        isNsfw: value.isNsfw,
        publicationStatus: value.publicationStatus,
        sortTitle: deriveSortTitle(value.title),
        title: value.title,
        version: current.version + 1,
      })
      .where(eq(work.id, current.id));

    await insertWorkFts(tx, current.id);

    const normalizedUrl = normalize(value.sourceUrl);
    const [platform] = await tx
      .select({ id: sourcePlatform.id })
      .from(sourcePlatform)
      .where(eq(sourcePlatform.publicId, value.sourcePlatformId))
      .limit(1);

    if (!platform) {
      throw new Error("Unknown source platform.");
    }

    const [primarySource] = await tx
      .select({ id: workSource.id })
      .from(workSource)
      .where(
        and(eq(workSource.workId, current.id), eq(workSource.deleted, false))
      )
      .orderBy(asc(workSource.createdAt))
      .limit(1);

    await (primarySource
      ? tx
          .update(workSource)
          .set({
            normalizedUrl,
            sourcePlatformId: platform.id,
            url: value.sourceUrl,
          })
          .where(eq(workSource.id, primarySource.id))
      : tx.insert(workSource).values({
          normalizedUrl,
          sourcePlatformId: platform.id,
          url: value.sourceUrl,
          workId: current.id,
        }));

    const authorNormalizedName = normalize(value.authorName);
    const [existingContributor] = await tx
      .select({ id: contributor.id })
      .from(contributor)
      .where(eq(contributor.normalizedName, authorNormalizedName))
      .limit(1);

    const [newContributor] = existingContributor
      ? []
      : await tx
          .insert(contributor)
          .values({
            name: value.authorName,
            normalizedName: authorNormalizedName,
          })
          .returning({ id: contributor.id });

    const contributorId = existingContributor?.id ?? newContributor?.id;
    if (!contributorId) {
      throw new Error("Failed to resolve contributor.");
    }

    await tx
      .delete(workContributor)
      .where(
        and(
          eq(workContributor.workId, current.id),
          eq(workContributor.role, "author")
        )
      );
    await tx.insert(workContributor).values({
      contributorId,
      role: "author",
      workId: current.id,
    });

    const existingAssignments = await tx
      .select({ taxonomyTermId: workTaxonomyAssignment.taxonomyTermId })
      .from(workTaxonomyAssignment)
      .where(eq(workTaxonomyAssignment.workId, current.id));

    const nextTermRows =
      value.taxonomyTermIds.length > 0
        ? await tx
            .select({ id: taxonomyTerm.id })
            .from(taxonomyTerm)
            .where(inArray(taxonomyTerm.publicId, value.taxonomyTermIds))
        : [];

    const existingIds = new Set(
      existingAssignments.map((row) => row.taxonomyTermId)
    );
    const nextIds = new Set(nextTermRows.map((row) => row.id));
    const toAdd = [...nextIds].filter((id) => !existingIds.has(id));
    const toRemove = [...existingIds].filter((id) => !nextIds.has(id));

    if (toAdd.length > 0) {
      await tx.insert(workTaxonomyAssignment).values(
        toAdd.map((taxonomyTermId) => ({
          taxonomyTermId,
          workId: current.id,
        }))
      );
    }
    if (toRemove.length > 0) {
      await tx
        .delete(workTaxonomyAssignment)
        .where(
          and(
            eq(workTaxonomyAssignment.workId, current.id),
            inArray(workTaxonomyAssignment.taxonomyTermId, toRemove)
          )
        );
    }
    const taxonomyChanged = toAdd.length > 0 || toRemove.length > 0;
    if (taxonomyChanged) {
      await rebuildEffectiveTaxonomyForWork(tx, current.id);
    }

    await recordAudit(
      tx,
      { action: "update-work", actorId: session.user.id },
      {
        after: {
          contentRating: value.contentRating,
          publicationStatus: value.publicationStatus,
          title: value.title,
        },
        before: {
          contentRating: current.contentRating,
          publicationStatus: current.publicationStatus,
          title: current.title,
        },
        changedColumns: ["title", "content_rating", "publication_status"],
        entityId: current.id,
        entityType: "work",
        version: current.version + 1,
      }
    );

    return {
      status: "success" as const,
      taxonomyChanged,
    };
  });

  if (result.status === "success") {
    revalidateTag(workTag(workPublicId), "max");
    revalidateTag(libraryListTag, "max");
    revalidateTag(libraryStatsTag, "max");
    if (result.taxonomyChanged) {
      revalidateTag(workTaxonomyEffectiveTag(workPublicId), "max");
    }

    return {
      errorMap: {},
      errors: [],
      status: "success" as const,
      values: value,
      workPublicId,
    };
  }

  if (result.status === "version-conflict") {
    return {
      currentVersion: result.currentVersion,
      errorMap: {},
      errors: [],
      status: "version-conflict" as const,
      values: value,
    };
  }

  return {
    errorMap: {},
    errors: [],
    status: "not-found" as const,
    values: value,
  };
};

/**
 * Removes a work from the catalog outright -- soft-delete only
 * (work.deleted), never a hard DELETE, same tombstone discipline as
 * deleteLibraryEntryAction. Distinct from that action: this purges the
 * canonical catalog entry itself, not just this admin's library record of
 * it. Cascades to soft-delete every library_entry (and its reading_state)
 * still referencing this work via softDeleteLibraryEntry -- in this
 * single-user app there is at most one (library_entry_user_work_uidx), but
 * the loop stays general rather than assuming that constraint here too.
 *
 * work_source, work_contributor, and work_taxonomy_assignment rows for this
 * work are left as-is, not cleaned up -- they're not synced tables (only
 * work_source is, and it has its own independent delete path,
 * deleteWorkSourceAction) and every read path already joins through
 * work.deleted, so an orphaned join row is inert, never displayed.
 */
export const deleteWorkAction = async (
  workPublicId: string,
  expectedVersion: number
): Promise<MutationResult<{ deleted: true }>> => {
  const session = await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: work.id, version: work.version })
      .from(work)
      .where(and(eq(work.publicId, workPublicId), eq(work.deleted, false)))
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

    const affectedEntries = await tx
      .select({ id: libraryEntry.id, version: libraryEntry.version })
      .from(libraryEntry)
      .where(
        and(
          eq(libraryEntry.workId, current.id),
          eq(libraryEntry.deleted, false)
        )
      );

    for (const entry of affectedEntries) {
      // biome-ignore lint/performance/noAwaitInLoops: each entry's cascade runs its own oplog writes and must stay ordered against the work's own delete below
      await softDeleteLibraryEntry(
        tx,
        session.user.id,
        entry.id,
        entry.version
      );
    }

    const nextVersion = current.version + 1;

    // A deleted work shouldn't be searchable -- remove it from work_fts
    // before the update below, not after (removeWorkFromFts's doc).
    await removeWorkFromFts(tx, current.id);

    await tx
      .update(work)
      .set({ deleted: true, version: nextVersion })
      .where(eq(work.id, current.id));

    await recordAudit(
      tx,
      { action: "delete-work", actorId: session.user.id },
      {
        after: null,
        before: { deleted: false },
        changedColumns: ["deleted"],
        entityId: current.id,
        entityType: "work",
        version: nextVersion,
      }
    );

    return { data: { deleted: true as const }, status: "success" as const };
  });

  if (result.status === "success") {
    revalidateTag(workTag(workPublicId), "max");
    revalidateTag(libraryStatsTag, "max");
    revalidateTag(libraryListTag, "max");
  }

  return result;
};

/**
 * Removes one source link from a work -- soft-delete only
 * (work_source.deleted), same discipline as deleteWorkAction above. Does
 * not touch the parent work or its library_entry; a work can have sources
 * on multiple platforms, and removing one is independent of the others.
 */
export const deleteWorkSourceAction = async (
  workSourcePublicId: string,
  expectedVersion: number
): Promise<MutationResult<{ deleted: true }>> => {
  const session = await requireAdmin();

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: workSource.id,
        version: workSource.version,
        workPublicId: work.publicId,
      })
      .from(workSource)
      .innerJoin(work, eq(work.id, workSource.workId))
      .where(
        and(
          eq(workSource.publicId, workSourcePublicId),
          eq(workSource.deleted, false)
        )
      )
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

    const nextVersion = current.version + 1;

    await tx
      .update(workSource)
      .set({ deleted: true, version: nextVersion })
      .where(eq(workSource.id, current.id));

    await recordAudit(
      tx,
      { action: "delete-work-source", actorId: session.user.id },
      {
        after: null,
        before: { deleted: false },
        changedColumns: ["deleted"],
        entityId: current.id,
        entityType: "work_source",
        version: nextVersion,
      }
    );

    return {
      data: { deleted: true as const },
      status: "success" as const,
      workPublicId: current.workPublicId,
    };
  });

  if (result.status === "success") {
    revalidateTag(workTag(result.workPublicId), "max");
    revalidateTag(libraryStatsTag, "max");
    revalidateTag(libraryListTag, "max");
  }

  return result;
};
