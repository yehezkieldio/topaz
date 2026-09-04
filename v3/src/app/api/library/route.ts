import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { libraryStatusValues } from "@/features/library/search-params";
import { getLibraryList } from "@/features/library/server/queries";

const isLibraryStatus = (
  value: string | null
): value is (typeof libraryStatusValues)[number] =>
  value !== null && (libraryStatusValues as readonly string[]).includes(value);

export const GET = async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");

  const page = await getLibraryList({
    cursor: params.get("cursor") ?? undefined,
    search: params.get("q") ?? undefined,
    status: isLibraryStatus(status) ? status : undefined,
  });

  return NextResponse.json(page);
};
