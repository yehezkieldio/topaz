import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

import {
  contentRatingEnum,
  publicationStatusEnum,
} from "@/server/db/schema/catalog";

export const workFormSchema = z.object({
  authorName: z.string().trim().min(1, "Author name is required").max(200),
  contentRating: z.enum(contentRatingEnum.enumValues),
  isNsfw: z.boolean(),
  publicationStatus: z.enum(publicationStatusEnum.enumValues),
  sortTitle: z.string().trim().min(1, "Sort title is required").max(300),
  sourcePlatformId: z.string().trim().min(1, "Choose a source platform"),
  sourceUrl: z.url("Enter a valid URL"),
  taxonomyTermIds: z.array(z.string()),
  title: z.string().trim().min(1, "Title is required").max(300),
});

export type WorkFormValues = z.infer<typeof workFormSchema>;

const defaultValues: WorkFormValues = {
  authorName: "",
  contentRating: "not_rated",
  isNsfw: false,
  publicationStatus: "in_progress",
  sortTitle: "",
  sourcePlatformId: "",
  sourceUrl: "",
  taxonomyTermIds: [],
  title: "",
};

export const workFormOpts = formOptions({ defaultValues });

const safeParseJsonArray = (raw: string): unknown[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Normalizes raw FormData quirks that only ever show up on the server (the
 * client's live form state never has these problems, since defaultValues
 * and the taxonomy picker's onSelectionChange keep both fields well-typed):
 *
 * - Unchecked HTML checkboxes are omitted from FormData entirely, so
 *   `isNsfw` arrives as undefined rather than false.
 * - The taxonomy picker submits its selection as one hidden input holding a
 *   JSON string (native FormData has no array convention without
 *   bracket-indexed inputs), so `taxonomyTermIds` arrives as that string,
 *   not an array.
 *
 * Kept out of `workFormSchema` itself so the schema's input/output types
 * stay symmetric with `WorkFormValues` -- required for TanStack Form's
 * client-side `validators.onChange` typing.
 */
export const normalizeRawWorkFormData = (
  value: Record<string, unknown>
): Record<string, unknown> => {
  const { taxonomyTermIds } = value;
  return {
    ...value,
    isNsfw: value.isNsfw ?? false,
    taxonomyTermIds:
      typeof taxonomyTermIds === "string"
        ? safeParseJsonArray(taxonomyTermIds)
        : taxonomyTermIds,
  };
};
