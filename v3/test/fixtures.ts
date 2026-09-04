import { eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  libraryEntry,
  sourcePlatform,
  work,
  workSource,
} from "@/server/db/schema";

export const createWorkFixture = async (userId: string) => {
  const [platform] = await db
    .select({ id: sourcePlatform.id })
    .from(sourcePlatform)
    .where(eq(sourcePlatform.slug, "ao3"))
    .limit(1);

  if (!platform) {
    throw new Error("Fixture setup: 'ao3' source platform is not seeded.");
  }

  const [createdWork] = await db
    .insert(work)
    .values({
      contentRating: "general",
      publicationStatus: "in_progress",
      sortTitle: "fixture work",
      title: "Fixture Work",
    })
    .returning();

  if (!createdWork) {
    throw new Error("Fixture setup: failed to insert work.");
  }

  await db.insert(workSource).values({
    normalizedUrl: `https://archiveofourown.org/works/${createdWork.id}`,
    sourcePlatformId: platform.id,
    url: `https://archiveofourown.org/works/${createdWork.id}`,
    workId: createdWork.id,
  });

  const [entry] = await db
    .insert(libraryEntry)
    .values({ status: "plan_to_read", userId, workId: createdWork.id })
    .returning();

  if (!entry) {
    throw new Error("Fixture setup: failed to insert library entry.");
  }

  return { entry, work: createdWork };
};
