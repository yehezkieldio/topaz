import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

const isTaxonomyMode = (
  value: string | null
): value is "direct" | "effective" =>
  value === "direct" || value === "effective";

const parseRating = (value: string | null): number | undefined => {
  if (!value) {
    return;
  }
  const parsed = Math.trunc(Number(value));
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const GET = async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const contentRating = params.get("contentRating");
  const publicationStatus = params.get("publicationStatus");
  const taxonomyMode = params.get("tagMode");
  const tags = params.get("tags");

  const page = await getLibraryList({
    contentRating: isContentRating(contentRating) ? contentRating : undefined,
    cursor: params.get("cursor") ?? undefined,
    favoriteOnly: params.get("favorite") === "1",
    featuredOnly: params.get("featured") === "1",
    minRating: parseRating(params.get("minRating")),
    publicationStatus: isPublicationStatus(publicationStatus)
      ? publicationStatus
      : undefined,
    search: params.get("q") ?? undefined,
    sourcePlatformId: params.get("source") ?? undefined,
    status: isLibraryStatus(status) ? status : undefined,
    taxonomyMode: isTaxonomyMode(taxonomyMode) ? taxonomyMode : undefined,
    taxonomyTermIds: tags ? tags.split(",").filter(Boolean) : undefined,
  });

  return NextResponse.json(page);
};
