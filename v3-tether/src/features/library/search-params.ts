import {
  createSearchParamsCache,
  parseAsFloat,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import {
  contentRatingEnum,
  publicationStatusEnum,
} from "@/server/db/schema/catalog";
import { libraryEntry } from "@/server/db/schema/library";

export const libraryStatusValues = libraryEntry.status.enumValues;

export const libraryStatusParser = parseAsStringLiteral(libraryStatusValues);
export const contentRatingParser = parseAsStringLiteral(
  contentRatingEnum.enumValues
);
export const publicationStatusParser = parseAsStringLiteral(
  publicationStatusEnum.enumValues
);

export const librarySearchParsers = {
  contentRating: contentRatingParser,
  minRating: parseAsFloat,
  publicationStatus: publicationStatusParser,
  q: parseAsString.withDefault(""),
  source: parseAsString,
  status: libraryStatusParser,
};

export const librarySearchParamsCache =
  createSearchParamsCache(librarySearchParsers);
