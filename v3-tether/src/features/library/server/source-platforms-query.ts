import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";

import { db } from "@/server/db/client";
import { sourcePlatform } from "@/server/db/schema";

const fetchSourcePlatforms = async () => {
  "use cache";
  cacheLife("days");
  cacheTag("source-platforms");

  return await db
    .select({
      baseUrl: sourcePlatform.baseUrl,
      id: sourcePlatform.publicId,
      name: sourcePlatform.name,
    })
    .from(sourcePlatform)
    .orderBy(sourcePlatform.name);
};

export const getSourcePlatforms = cache(fetchSourcePlatforms);
