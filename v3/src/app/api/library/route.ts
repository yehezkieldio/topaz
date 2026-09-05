import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { LIBRARY_PAGE_SIZE } from "@/features/library/query-key";
import { libraryStatusValues } from "@/features/library/search-params";
import { getLibraryList } from "@/features/library/server/queries";
import {
  contentRatingEnum,
  publicationStatusEnum,
} from "@/server/db/schema/catalog";

const isLibraryStatus = (
  value: string | null
): value is (typeof libraryStatusValues)[number] =>
  value !== null && (libraryStatusValues as readonly string[]).includes(value);

const isContentRating = (
  value: string | null
): value is (typeof contentRatingEnum.enumValues)[number] =>
  value !== null &&
  (contentRatingEnum.enumValues as readonly string[]).includes(value);

const isPublicationStatus = (
  value: string | null
): value is (typeof publicationStatusEnum.enumValues)[number] =>
  value !== null &&
  (publicationStatusEnum.enumValues as readonly string[]).includes(value);

const parseRating = (value: string | null): number | undefined => {
  if (!value) {
    return;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const GET = async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const contentRating = params.get("contentRating");
  const publicationStatus = params.get("publicationStatus");

  const page = await getLibraryList({
    contentRating: isContentRating(contentRating) ? contentRating : undefined,
    cursor: params.get("cursor") ?? undefined,
    limit: LIBRARY_PAGE_SIZE,
    minRating: parseRating(params.get("minRating")),
    publicationStatus: isPublicationStatus(publicationStatus)
      ? publicationStatus
      : undefined,
    search: params.get("q") ?? undefined,
    sourcePlatformId: params.get("source") ?? undefined,
    status: isLibraryStatus(status) ? status : undefined,
  });

  // Public data only (private entries are filtered out in getLibraryList),
  // so it's safe to share across viewers on the CDN. 60s matches the
  // client-side staleTime the infinite-scroll list already uses
  // (library-list-virtualized.tsx), with a longer SWR window so a cache miss
  // never blocks on the origin.
  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
};
