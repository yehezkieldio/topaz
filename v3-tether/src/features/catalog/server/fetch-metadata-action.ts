"use server";

import { z } from "zod";

import { requireAdmin } from "@/server/auth/require-admin";
import type { publicationStatusEnum } from "@/server/db/schema";

const FICHUB_EPUB_ENDPOINT = "https://fichub.net/api/v0/epub";
const FETCH_TIMEOUT_MS = 10_000;

type PublicationStatus = (typeof publicationStatusEnum.enumValues)[number];

/**
 * FicHub's shape isn't contractually guaranteed -- a field can arrive as an
 * object, an array, or absent entirely depending on the source site and
 * FicHub's own scrape state for it. Parsing at this boundary (rather than
 * ad-hoc `typeof` checks deeper in the code) means every field below is
 * either the declared type or `undefined`, never "whatever FicHub sent".
 */
const ficHubMetaSchema = z.object({
  author: z.string().optional(),
  chapters: z.number().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  title: z.string().optional(),
  words: z.number().optional(),
});

/** FicHub has returned both a flat shape and one nested under `meta` at different times. */
const ficHubResponseSchema = ficHubMetaSchema.extend({
  meta: ficHubMetaSchema.optional(),
});

export interface FetchedWorkMetadata {
  title: string | null;
  author: string | null;
  description: string | null;
  publicationStatus: PublicationStatus | null;
  wordCount: number | null;
  chapterCount: number | null;
}

/**
 * `ficHubMetaSchema` already guarantees `raw` is `string | undefined` --
 * this just collapses "absent" and "blank" into the same `null` result.
 */
const pickString = (raw: string | undefined): string | null => {
  if (raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
};

const pickNumber = (raw: number | undefined): number | null =>
  raw !== undefined && Number.isFinite(raw) ? raw : null;

const mapFicHubStatus = (raw: string | undefined): PublicationStatus | null => {
  const status = pickString(raw);
  if (!status) {
    return null;
  }
  const lower = status.toLowerCase();
  if (lower.includes("complete")) {
    return "completed";
  }
  if (lower.includes("hiatus")) {
    return "hiatus";
  }
  if (lower.includes("abandon")) {
    return "abandoned";
  }
  if (lower.includes("progress") || lower.includes("ongoing")) {
    return "in_progress";
  }
  return null;
};

/**
 * Pulls title/author/chapter/word-count metadata from a story URL via
 * FicHub's public API (covers AO3, FFN, and most other fic archives) so
 * bulk-adding entries doesn't require typing these in by hand, then going
 * back to edit them once the real numbers are known.
 */
export const fetchWorkMetadataAction = async (
  url: string
): Promise<FetchedWorkMetadata | null> => {
  await requireAdmin();

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  const endpoint = new URL(FICHUB_EPUB_ENDPOINT);
  endpoint.searchParams.set("q", parsedUrl.toString());

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }

    const parsed = ficHubResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }
    const rawMeta = parsed.data.meta ?? parsed.data;

    const title = pickString(rawMeta.title);
    const chapterCount = pickNumber(rawMeta.chapters);
    const wordCount = pickNumber(rawMeta.words);

    if (!(title || chapterCount || wordCount)) {
      return null;
    }

    return {
      author: pickString(rawMeta.author),
      chapterCount,
      description: pickString(rawMeta.description),
      publicationStatus: mapFicHubStatus(rawMeta.status),
      title,
      wordCount,
    };
  } catch {
    // Network error, timeout, or malformed JSON -- treated as "no metadata
    // available", same as a 404, so the caller falls back to manual entry.
    return null;
  }
};
