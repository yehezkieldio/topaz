import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import {
  libraryEntry,
  sourcePlatform,
  taxonomyKind,
  taxonomyTerm,
  work,
  workSource,
  workTaxonomyEffective,
} from "@/server/db/schema";

import { createTestUser, truncateAppData } from "../../../../test/db-helpers";
import { getLibraryList } from "./queries";

beforeEach(async () => {
  await truncateAppData();
});

interface FixtureOptions {
  title: string;
  contentRating?: (typeof work.contentRating.enumValues)[number];
  publicationStatus?: (typeof work.publicationStatus.enumValues)[number];
  favorite?: boolean;
  isFeatured?: boolean;
  displayOrder?: number | null;
}

const createFixture = async (userId: string, options: FixtureOptions) => {
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
      contentRating: options.contentRating ?? "general",
      publicationStatus: options.publicationStatus ?? "in_progress",
      sortTitle: options.title.toLowerCase(),
      title: options.title,
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
    .values({
      displayOrder: options.displayOrder,
      favorite: options.favorite ?? false,
      isFeatured: options.isFeatured ?? false,
      status: "plan_to_read",
      userId,
      workId: createdWork.id,
    })
    .returning();
  if (!entry) {
    throw new Error("Fixture setup: failed to insert library entry.");
  }

  return { entry, work: createdWork };
};

const createTerm = async (name: string) => {
  const [kind] = await db
    .select({ id: taxonomyKind.id })
    .from(taxonomyKind)
    .where(eq(taxonomyKind.slug, "custom"))
    .limit(1);
  if (!kind) {
    throw new Error("Fixture setup: 'custom' taxonomy kind is not seeded.");
  }
  const [term] = await db
    .insert(taxonomyTerm)
    .values({
      name,
      normalizedName: name.toLowerCase(),
      slug: name.toLowerCase(),
      taxonomyKindId: kind.id,
    })
    .returning();
  if (!term) {
    throw new Error("Fixture setup: failed to insert taxonomy term.");
  }
  return term;
};

describe("getLibraryList: filter breadth", () => {
  it("filters by content rating", async () => {
    const admin = await createTestUser("admin");
    await createFixture(admin.id, { contentRating: "general", title: "A" });
    await createFixture(admin.id, { contentRating: "explicit", title: "B" });

    const page = await getLibraryList({ contentRating: "explicit" });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe("B");
  });

  it("filters by publication status", async () => {
    const admin = await createTestUser("admin");
    await createFixture(admin.id, {
      publicationStatus: "in_progress",
      title: "A",
    });
    await createFixture(admin.id, {
      publicationStatus: "completed",
      title: "B",
    });

    const page = await getLibraryList({ publicationStatus: "completed" });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe("B");
  });

  it("search matches an effective taxonomy term name, not just the title", async () => {
    const admin = await createTestUser("admin");
    const { work: workA } = await createFixture(admin.id, { title: "A" });
    await createFixture(admin.id, { title: "B" });
    const term = await createTerm("qa-searchable-tag");

    await db.insert(workTaxonomyEffective).values({
      depth: 0,
      reason: "direct",
      taxonomyTermId: term.id,
      workId: workA.id,
    });

    const page = await getLibraryList({ search: term.name });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.title).toBe("A");
  });
});
