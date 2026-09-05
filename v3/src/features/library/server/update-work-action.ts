"use server";

import {
  createServerValidate,
  ServerValidateError,
} from "@tanstack/react-form-nextjs";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import {
  normalizeRawWorkFormData,
  workFormOpts,
  workFormSchema,
} from "@/features/library/forms/work-form/shared-code";
import { workTaxonomyEffectiveTag } from "@/features/taxonomy/server/cache-tags";
import { rebuildEffectiveTaxonomyForWork } from "@/features/taxonomy/server/repository/effective-taxonomy";
import { requireAdmin } from "@/server/auth/require-admin";
import { recordAudit } from "@/server/db/audit";
import { db } from "@/server/db/client";
import {
  contributor,
  sourcePlatform,
  taxonomyTerm,
  work,
  workContributor,
  workSource,
  workSourceObservation,
  workTaxonomyAssignment,
} from "@/server/db/schema";

import { libraryListTag, libraryStatsTag, workTag } from "./cache-tags";

const normalize = (value: string) => value.trim().toLowerCase();

export interface WorkEditDetail {
  workPublicId: string;
  version: number;
  title: string;
  sortTitle: string;
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
}

/**
 * Feeds the edit sheet's initial form state. Admin-only, on-demand read
 * (not "use cache") -- called directly from a client component the moment
 * the sheet opens, not rendered as part of any cached list.
 */
export const getWorkEditDetailAction = async (
  workPublicId: string
): Promise<WorkEditDetail | null> => {
  await requireAdmin();

  const [workRow] = await db
    .select({
      contentRating: work.contentRating,
      id: work.id,
      isNsfw: work.isNsfw,
      publicationStatus: work.publicationStatus,
      sortTitle: work.sortTitle,
      title: work.title,
      version: work.version,
    })
    .from(work)
    .where(eq(work.publicId, workPublicId))
    .limit(1);

  if (!workRow) {
    return null;
  }

  const [sourceRow] = await db
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
    .where(eq(workSource.workId, workRow.id))
    .orderBy(asc(workSource.createdAt))
    .limit(1);

  const [contributorRow] = await db
    .select({ name: contributor.name })
    .from(workContributor)
    .innerJoin(contributor, eq(contributor.id, workContributor.contributorId))
    .where(
      and(
        eq(workContributor.workId, workRow.id),
        eq(workContributor.role, "author")
      )
    )
    .limit(1);

  const taxonomyRows = await db
    .select({ id: taxonomyTerm.publicId, label: taxonomyTerm.name })
    .from(workTaxonomyAssignment)
    .innerJoin(
      taxonomyTerm,
      eq(taxonomyTerm.id, workTaxonomyAssignment.taxonomyTermId)
    )
    .where(eq(workTaxonomyAssignment.workId, workRow.id));

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
    isNsfw: workRow.isNsfw,
    latestChapterCount: sourceRow?.chapterCount ?? null,
    latestPublicationStatus: latestObservation?.publicationStatus ?? null,
    latestWordCount: sourceRow?.wordCount ?? null,
    publicationStatus: workRow.publicationStatus,
    sortTitle: workRow.sortTitle,
    sourcePlatformId: sourceRow?.sourcePlatformId ?? "",
    sourceUrl: sourceRow?.sourceUrl ?? "",
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
  onServerValidate: ({ value }) => {
    const result = workFormSchema.safeParse(normalizeRawWorkFormData(value));
    if (result.success) {
      return;
    }
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      fields[key] ??= issue.message;
    }
    return { fields };
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
  _previousState: unknown,
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
      .where(eq(work.publicId, workPublicId))
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

    await tx
      .update(work)
      .set({
        contentRating: value.contentRating,
        isNsfw: value.isNsfw,
        publicationStatus: value.publicationStatus,
        sortTitle: value.sortTitle,
        title: value.title,
        version: current.version + 1,
      })
      .where(eq(work.id, current.id));

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
      .where(eq(workSource.workId, current.id))
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
