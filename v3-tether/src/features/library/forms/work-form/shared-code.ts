import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

import {
  contentRatingEnum,
  publicationStatusEnum,
} from "@/server/db/schema/catalog";

export const workFormSchema = z.object({
  authorName: z.string().trim().min(1, "Author name is required").max(200),
  contentRating: z.enum(contentRatingEnum.enumValues),
  description: z.string().trim().max(10_000),
  isNsfw: z.boolean(),
  publicationStatus: z.enum(publicationStatusEnum.enumValues),
  sourcePlatformId: z.string().trim().min(1, "Choose a source platform"),
  sourceUrl: z.string().trim().pipe(z.url("Enter a valid URL")),
  taxonomyTermIds: z.array(z.string()),
  title: z.string().trim().min(1, "Title is required").max(300),
});

export type WorkFormValues = z.infer<typeof workFormSchema>;

const defaultValues: WorkFormValues = {
  authorName: "",
  contentRating: "not_rated",
  description: "",
  isNsfw: false,
  publicationStatus: "in_progress",
  sourcePlatformId: "",
  sourceUrl: "",
  taxonomyTermIds: [],
  title: "",
};

export const workFormOpts = formOptions({ defaultValues });

const LEADING_ARTICLE_PATTERN = /^(?:a|an|the)\s+/iu;

/**
 * `work.sort_title` isn't reader-facing -- it exists only so alphabetical
 * listings (e.g. the featured-works order) don't scatter "The Foo" under T.
 * Deriving it from the title keeps that behavior without asking anyone to
 * fill in a field they'd never think to fill in correctly.
 */
export const deriveSortTitle = (title: string): string =>
  title.trim().replace(LEADING_ARTICLE_PATTERN, "").toLowerCase();

const safeParseJsonArray = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

/**
 * Shape of `createServerValidate`'s decoded FormData before the two
 * server-only quirks below are normalized away. Everything except
 * `isNsfw`/`taxonomyTermIds` already matches `WorkFormValues`, since those
 * are the only two fields FormData's native encoding can't represent
 * faithfully.
 */
export interface RawWorkFormData extends Omit<
  WorkFormValues,
  "isNsfw" | "taxonomyTermIds"
> {
  isNsfw?: boolean;
  taxonomyTermIds: string[] | string;
}

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
  value: RawWorkFormData
): WorkFormValues => {
  const { taxonomyTermIds } = value;
  return {
    ...value,
    isNsfw: value.isNsfw ?? false,
    taxonomyTermIds: Array.isArray(taxonomyTermIds)
      ? taxonomyTermIds
      : safeParseJsonArray(taxonomyTermIds),
  };
};
