"use server";

import {
  createServerValidate,
  ServerValidateError,
} from "@tanstack/react-form-nextjs";
import { eq, inArray } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import {
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
  sourcePlatform,
  taxonomyTerm,
  work,
  workContributor,
  workSource,
  workTaxonomyAssignment,
} from "@/server/db/schema";

const normalize = (value: string) => value.trim().toLowerCase();

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

  const { taxonomyAssigned, workPublicId } = await db.transaction(
    async (tx) => {
      const normalizedUrl = normalize(value.sourceUrl);

      const [createdWork] = await tx
        .insert(work)
        .values({
          contentRating: value.contentRating,
          isNsfw: value.isNsfw,
          publicationStatus: value.publicationStatus,
          sortTitle: value.sortTitle,
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

      await tx.insert(workSource).values({
        normalizedUrl,
        sourcePlatformId: platform.id,
        url: value.sourceUrl,
        workId: createdWork.id,
      });

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

      await tx.insert(libraryEntry).values({
        status: "plan_to_read",
        userId: session.user.id,
        workId: createdWork.id,
      });

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
