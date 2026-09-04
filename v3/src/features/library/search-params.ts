import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { libraryEntry } from "@/server/db/schema/library";

export const libraryStatusValues = libraryEntry.status.enumValues;

export const libraryStatusParser = parseAsStringLiteral(libraryStatusValues);

export const librarySearchParsers = {
  q: parseAsString.withDefault(""),
  status: libraryStatusParser,
};

export const librarySearchParamsCache =
  createSearchParamsCache(librarySearchParsers);
