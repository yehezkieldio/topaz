import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import {
  taxonomyKind,
  taxonomyRelation,
  taxonomyTerm,
  work,
  workTaxonomyAssignment,
  workTaxonomyEffective,
} from "@/server/db/schema";

import { truncateAppData } from "../../../../../test/db-helpers";
import { rebuildEffectiveTaxonomyForWorks } from "./effective-taxonomy";

beforeEach(async () => {
  await truncateAppData();
});

const createWork = async (title: string) => {
  const [created] = await db
    .insert(work)
    .values({ sortTitle: title.toLowerCase(), title })
    .returning();
  if (!created) {
    throw new Error("Fixture setup: failed to insert work.");
  }
  return created;
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

const effectiveFor = async (workId: string) =>
  await db
    .select({
      reason: workTaxonomyEffective.reason,
      taxonomyTermId: workTaxonomyEffective.taxonomyTermId,
    })
    .from(workTaxonomyEffective)
    .where(eq(workTaxonomyEffective.workId, workId));

describe("rebuildEffectiveTaxonomyForWorks", () => {
  it("does nothing for an empty work id list", async () => {
    await expect(
      db.transaction((tx) => rebuildEffectiveTaxonomyForWorks(tx, []))
    ).resolves.toBeUndefined();
  });

  it("keeps each work's effective set isolated from the others in the same batch", async () => {
    const workA = await createWork("Work A");
    const workB = await createWork("Work B");
    const narrow = await createTerm("narrow");
    const broad = await createTerm("broad");
    const unrelated = await createTerm("unrelated");

    await db.insert(workTaxonomyAssignment).values([
      { taxonomyTermId: narrow.id, workId: workA.id },
      { taxonomyTermId: unrelated.id, workId: workB.id },
    ]);
    await db.insert(taxonomyRelation).values({
      fromTermId: narrow.id,
      relationType: "broader",
      toTermId: broad.id,
    });

    await db.transaction((tx) =>
      rebuildEffectiveTaxonomyForWorks(tx, [workA.id, workB.id])
    );

    const effectiveA = await effectiveFor(workA.id);
    const effectiveB = await effectiveFor(workB.id);

    expect(effectiveA.map((row) => row.taxonomyTermId).toSorted()).toEqual(
      [narrow.id, broad.id].toSorted()
    );
    expect(
      effectiveA.find((row) => row.taxonomyTermId === broad.id)?.reason
    ).toBe("inferred");
    expect(effectiveB.map((row) => row.taxonomyTermId)).toEqual([unrelated.id]);
  });

  it("resolves a chain up to MAX_DEPTH across the shared BFS frontier", async () => {
    const workA = await createWork("Work A");
    const level0 = await createTerm("level0");
    const level1 = await createTerm("level1");
    const level2 = await createTerm("level2");

    await db
      .insert(workTaxonomyAssignment)
      .values({ taxonomyTermId: level0.id, workId: workA.id });
    await db.insert(taxonomyRelation).values([
      { fromTermId: level0.id, relationType: "broader", toTermId: level1.id },
      { fromTermId: level1.id, relationType: "broader", toTermId: level2.id },
    ]);

    await db.transaction((tx) =>
      rebuildEffectiveTaxonomyForWorks(tx, [workA.id])
    );

    const effective = await effectiveFor(workA.id);
    expect(effective.map((row) => row.taxonomyTermId).toSorted()).toEqual(
      [level0.id, level1.id, level2.id].toSorted()
    );
  });

  it("replaces stale effective rows rather than accumulating them", async () => {
    const workA = await createWork("Work A");
    const termOne = await createTerm("term-one");
    const termTwo = await createTerm("term-two");

    await db
      .insert(workTaxonomyAssignment)
      .values({ taxonomyTermId: termOne.id, workId: workA.id });
    await db.transaction((tx) =>
      rebuildEffectiveTaxonomyForWorks(tx, [workA.id])
    );
    expect(await effectiveFor(workA.id)).toHaveLength(1);

    await db
      .delete(workTaxonomyAssignment)
      .where(eq(workTaxonomyAssignment.workId, workA.id));
    await db
      .insert(workTaxonomyAssignment)
      .values({ taxonomyTermId: termTwo.id, workId: workA.id });
    await db.transaction((tx) =>
      rebuildEffectiveTaxonomyForWorks(tx, [workA.id])
    );

    const effective = await effectiveFor(workA.id);
    expect(effective).toHaveLength(1);
    expect(effective[0]?.taxonomyTermId).toBe(termTwo.id);
  });
});
