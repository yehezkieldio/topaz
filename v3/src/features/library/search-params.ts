import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import {
  contentRatingEnum,
  publicationStatusEnum,
} from "@/server/db/schema/catalog";
import { libraryEntry } from "@/server/db/schema/library";

export const libraryStatusValues = libraryEntry.status.enumValues;
export const taxonomyModeValues = ["direct", "effective"] as const;

export const libraryStatusParser = parseAsStringLiteral(libraryStatusValues);
export const contentRatingParser = parseAsStringLiteral(
  contentRatingEnum.enumValues
);
export const publicationStatusParser = parseAsStringLiteral(
  publicationStatusEnum.enumValues
);
export const taxonomyModeParser = parseAsStringLiteral(taxonomyModeValues);

export const librarySearchParsers = {
  contentRating: contentRatingParser,
  favorite: parseAsBoolean,
  featured: parseAsBoolean,
  minRating: parseAsInteger,
  publicationStatus: publicationStatusParser,
  q: parseAsString.withDefault(""),
  source: parseAsString,
  status: libraryStatusParser,
  tagMode: taxonomyModeParser,
  tags: parseAsArrayOf(parseAsString),
};

export const librarySearchParamsCache =
  createSearchParamsCache(librarySearchParsers);
