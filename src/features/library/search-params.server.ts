import "server-only";

import { createSearchParamsCache } from "nuqs/server";
import { librarySearchParamsParsers } from "#/features/library/search-params";

export const librarySearchParamsCache = createSearchParamsCache(librarySearchParamsParsers);
