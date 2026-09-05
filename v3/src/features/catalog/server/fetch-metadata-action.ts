"use server";

import { requireAdmin } from "@/server/auth/require-admin";
import type { publicationStatusEnum } from "@/server/db/schema";

const FICHUB_EPUB_ENDPOINT = "https://fichub.net/api/v0/epub";
const FETCH_TIMEOUT_MS = 10_000;

type PublicationStatus = (typeof publicationStatusEnum.enumValues)[number];

interface FicHubMeta {
  title?: string;
  author?: string;
  description?: string;
  status?: string;
  words?: number;
  chapters?: number;
}

/** FicHub has returned both a flat shape and one nested under `meta` at different times. */
type FicHubResponse = { meta?: FicHubMeta } & FicHubMeta;

export interface FetchedWorkMetadata {
  title: string | null;
  author: string | null;
  description: string | null;
  publicationStatus: PublicationStatus | null;
  wordCount: number | null;
  chapterCount: number | null;
}

/**
 * FicHub's shape isn't contractually guaranteed -- a field can arrive as an
 * object, an array, or absent entirely depending on the source site and
 * FicHub's own scrape state for it. Never trust it enough to hand a
 * non-string straight to a text field (that's how a form ends up showing
 * literal "[object Object]").
 */
const pickString = (raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
};

const pickNumber = (raw: unknown): number | null =>
  typeof raw === "number" && Number.isFinite(raw) ? raw : null;

const mapFicHubStatus = (raw: unknown): PublicationStatus | null => {
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

    const data = (await response.json()) as FicHubResponse;
    const rawMeta = (data.meta ?? data) as Record<string, unknown>;

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
