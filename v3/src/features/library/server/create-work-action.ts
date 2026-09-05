"use server";

import {
  createServerValidate,
  ServerValidateError,
} from "@tanstack/react-form-nextjs";
import { eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import {
  deriveSortTitle,
  normalizeRawWorkFormData,
  workFormOpts,
  workFormSchema,
} from "@/features/library/forms/work-form/shared-code";
import {
  libraryListTag,
  libraryStatsTag,
  workTag,
} from "@/features/library/server/cache-tags";
import { workTaxonomyEffectiveTag } from "@/features/taxonomy/server/cache-tags";
import { rebuildEffectiveTaxonomyForWork } from "@/features/taxonomy/server/repository/effective-taxonomy";
import { requireAdmin } from "@/server/auth/require-admin";
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

const normalize = (value: string) => value.trim().toLowerCase();

/** Trimmed, non-negative-integer parse -- empty/invalid input means "not set", not zero. */
const parseOptionalCount = (raw: FormDataEntryValue | null): number | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : Math.max(0, Math.trunc(parsed));
};

const serverValidate = createServerValidate({
  ...workFormOpts,
  // createServerValidate's onServerValidate only documents returning a
  // plain string (see the SSR guide) -- an earlier version of this
  // returned `{ fields }` (the shape validators.onSubmitAsync accepts, a
  // different API), which isGlobalFormValidationError happily matched on
  // (it just checks for a `fields` key) but createServerValidate never
  // decomposes, so the whole object landed in the error slot and rendered
  // as the literal string "[object Object]".
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

export const createWorkAction = async (
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

  const chapterCount = parseOptionalCount(formData.get("chapterCount"));
  const wordCount = parseOptionalCount(formData.get("wordCount"));
  const currentChapter = parseOptionalCount(formData.get("currentChapter"));

  const { taxonomyAssigned, workPublicId } = await db.transaction(
    async (tx) => {
      const normalizedUrl = normalize(value.sourceUrl);

      const [createdWork] = await tx
        .insert(work)
        .values({
          contentRating: value.contentRating,
          description: value.description?.trim() || null,
          isNsfw: value.isNsfw,
          publicationStatus: value.publicationStatus,
          sortTitle: deriveSortTitle(value.title),
          title: value.title,
        })
        .returning({ id: work.id, publicId: work.publicId });

      if (!createdWork) {
        throw new Error("Failed to create work.");
      }

      const [platform] = await tx
        .select({ id: sourcePlatform.id })
        .from(sourcePlatform)
        .where(eq(sourcePlatform.publicId, value.sourcePlatformId))
        .limit(1);

      if (!platform) {
        throw new Error("Unknown source platform.");
      }

      const [createdSource] = await tx
        .insert(workSource)
        .values({
          chapterCount,
          normalizedUrl,
          sourcePlatformId: platform.id,
          url: value.sourceUrl,
          wordCount,
          workId: createdWork.id,
        })
        .returning({ id: workSource.id });

      // Seeds the observation history at creation time -- otherwise the
      // first "Record refresh" in the edit sheet would look like the story's
      // first-ever recorded count, when really it's just the first *change*
      // since these totals were typed in here.
      if (createdSource && (chapterCount !== null || wordCount !== null)) {
        await tx.insert(workSourceObservation).values({
          chapterCount,
          source: "manual",
          wordCount,
          workId: createdWork.id,
          workSourceId: createdSource.id,
        });
      }

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

      await tx.insert(workContributor).values({
        contributorId,
        role: "author",
        workId: createdWork.id,
      });

      let didAssignTaxonomy = false;
      if (value.taxonomyTermIds.length > 0) {
        const termRows = await tx
          .select({ id: taxonomyTerm.id })
          .from(taxonomyTerm)
          .where(inArray(taxonomyTerm.publicId, value.taxonomyTermIds));

        if (termRows.length > 0) {
          await tx.insert(workTaxonomyAssignment).values(
            termRows.map((term) => ({
              taxonomyTermId: term.id,
              workId: createdWork.id,
            }))
          );
          await rebuildEffectiveTaxonomyForWork(tx, createdWork.id);
          didAssignTaxonomy = true;
        }
      }

      const [createdEntry] = await tx
        .insert(libraryEntry)
        .values({
          status: "plan_to_read",
          userId: session.user.id,
          workId: createdWork.id,
        })
        .returning({ id: libraryEntry.id });

      if (createdEntry && currentChapter !== null) {
        const now = new Date();
        await tx.insert(readingState).values({
          currentChapter,
          lastReadAt: now,
          libraryEntryId: createdEntry.id,
          startedAt: now,
          version: 1,
        });
      }

      return {
        taxonomyAssigned: didAssignTaxonomy,
        workPublicId: createdWork.publicId,
      };
    }
  );

  revalidateTag(workTag(workPublicId), "max");
  revalidateTag(libraryStatsTag, "max");
  revalidateTag(libraryListTag, "max");
  if (taxonomyAssigned) {
    revalidateTag(workTaxonomyEffectiveTag(workPublicId), "max");
  }

  // Shaped as a ServerFormState (values/errors/errorMap) so it stays
  // assignable to mergeForm's second argument on the client, with
  // `workPublicId` riding along as the one extra field that signals success.
  return {
    errorMap: {},
    errors: [],
    status: "success" as const,
    values: value,
    workPublicId,
  };
};
