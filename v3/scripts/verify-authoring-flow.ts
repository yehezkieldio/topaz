/**
 * Verifies the P2 acceptance-criteria authoring flow (01_acceptance_criteria.md):
 * create/edit work form creates work + work_source + contributor +
 * library_entry + taxonomy assignments in one submission; taxonomy
 * suggestion surfaces existing terms before a duplicate is created;
 * effective-taxonomy rebuild runs after an assignment/relation change and is
 * reflected in the DB. Exercises the real Server Actions against a real
 * Postgres database. Run via:
 *
 *   bun --preload ./scripts/lib/next-runtime-mock.ts scripts/verify-authoring-flow.ts
 */
import { eq } from "drizzle-orm";

import { headersRef } from "./lib/next-runtime-mock";
import {
  check,
  closeDb,
  createAuthHeaders,
  createTestUser,
  log,
  reportAndExit,
  seedReferenceData,
  truncateAppData,
} from "./lib/verify-env";

const main = async () => {
  await truncateAppData();
  await seedReferenceData();

  const {
    createTaxonomyTermAction,
    mergeTermsAction,
    searchTaxonomyTermsAction,
  } = await import("@/features/taxonomy/server/actions");
  const { createWorkAction } =
    await import("@/features/library/server/create-work-action");
  const { db } = await import("@/server/db/client");
  const {
    contributor,
    libraryEntry,
    taxonomyTerm,
    work,
    workContributor,
    workSource,
    workTaxonomyAssignment,
    workTaxonomyEffective,
  } = await import("@/server/db/schema");

  const admin = await createTestUser("admin");
  headersRef.current = await createAuthHeaders(admin.id);

  log.section("Taxonomy suggestion surfaces existing terms");

  const seededTerm = await createTaxonomyTermAction("Time Travel");
  if (seededTerm.status !== "success") {
    throw new Error("Failed to seed taxonomy term for suggestion check.");
  }

  await check(
    "searchTaxonomyTermsAction surfaces a close match before a duplicate is created",
    async () => {
      const results = await searchTaxonomyTermsAction("time travle");
      return results.some((option) => option.id === seededTerm.data.id);
    }
  );

  log.section(
    "createWorkAction creates work + work_source + contributor + library_entry + taxonomy assignment in one submission"
  );

  const formData = new FormData();
  formData.set("title", "Verify Authoring Flow");
  formData.set("sortTitle", "verify authoring flow");
  formData.set("authorName", "Verify Author");
  formData.set("sourcePlatformId", "");
  formData.set(
    "sourceUrl",
    "https://archiveofourown.org/works/verify-authoring-flow"
  );
  formData.set("contentRating", "general");
  formData.set("publicationStatus", "in_progress");
  formData.set("taxonomyTermIds", JSON.stringify([seededTerm.data.id]));

  const [platform] = await db.query.sourcePlatform.findMany({ limit: 1 });
  if (!platform) {
    throw new Error("Reference data seed did not create a source platform.");
  }
  formData.set("sourcePlatformId", platform.publicId);

  const result = await createWorkAction(undefined, formData);

  await check(
    "createWorkAction returns success with a new work id",
    () => "status" in result && result.status === "success"
  );

  const workPublicId =
    "status" in result && result.status === "success"
      ? result.workPublicId
      : "";

  const [createdWork] = await db
    .select()
    .from(work)
    .where(eq(work.publicId, workPublicId))
    .limit(1);

  await check("work row was created", () => Boolean(createdWork));

  await check("work_source row was created", async () => {
    if (!createdWork) {
      return false;
    }
    const rows = await db
      .select()
      .from(workSource)
      .where(eq(workSource.workId, createdWork.id));
    return rows.length === 1;
  });

  await check("contributor + work_contributor rows were created", async () => {
    if (!createdWork) {
      return false;
    }
    const rows = await db
      .select()
      .from(workContributor)
      .innerJoin(contributor, eq(workContributor.contributorId, contributor.id))
      .where(eq(workContributor.workId, createdWork.id));
    return rows.length === 1 && rows[0]?.contributor.name === "Verify Author";
  });

  await check("library_entry row was created for the admin user", async () => {
    if (!createdWork) {
      return false;
    }
    const rows = await db
      .select()
      .from(libraryEntry)
      .where(eq(libraryEntry.workId, createdWork.id));
    return rows.length === 1 && rows[0]?.userId === admin.id;
  });

  await check(
    "work_taxonomy_assignment row was created for the chosen term",
    async () => {
      if (!createdWork) {
        return false;
      }
      const rows = await db
        .select({ publicId: taxonomyTerm.publicId })
        .from(workTaxonomyAssignment)
        .innerJoin(
          taxonomyTerm,
          eq(workTaxonomyAssignment.taxonomyTermId, taxonomyTerm.id)
        )
        .where(eq(workTaxonomyAssignment.workId, createdWork.id));
      return rows.length === 1 && rows[0]?.publicId === seededTerm.data.id;
    }
  );

  await check(
    "effective-taxonomy rebuild ran: work_taxonomy_effective reflects the direct assignment",
    async () => {
      if (!createdWork) {
        return false;
      }
      const rows = await db
        .select({
          publicId: taxonomyTerm.publicId,
          reason: workTaxonomyEffective.reason,
        })
        .from(workTaxonomyEffective)
        .innerJoin(
          taxonomyTerm,
          eq(workTaxonomyEffective.taxonomyTermId, taxonomyTerm.id)
        )
        .where(eq(workTaxonomyEffective.workId, createdWork.id));
      return (
        rows.length === 1 &&
        rows[0]?.publicId === seededTerm.data.id &&
        rows[0]?.reason === "direct"
      );
    }
  );

  log.section(
    "Merging taxonomy terms re-runs the effective-taxonomy rebuild for affected works"
  );

  const otherTerm = await createTaxonomyTermAction("Temporal Displacement");
  if (otherTerm.status !== "success") {
    throw new Error("Failed to create the second term for the merge check.");
  }

  const [otherTermRow] = await db
    .select({ id: taxonomyTerm.id })
    .from(taxonomyTerm)
    .where(eq(taxonomyTerm.publicId, otherTerm.data.id))
    .limit(1);
  if (!otherTermRow) {
    throw new Error("Failed to look up the second term's internal id.");
  }
  if (!createdWork) {
    throw new Error("createWorkAction did not create a work row.");
  }
  await db.insert(workTaxonomyAssignment).values({
    taxonomyTermId: otherTermRow.id,
    workId: createdWork.id,
  });

  const mergeResult = await mergeTermsAction(
    seededTerm.data.id,
    otherTerm.data.id
  );

  await check(
    "mergeTermsAction succeeds",
    () => mergeResult.status === "success"
  );

  await check(
    "effective taxonomy re-points to only the winning term after merge",
    async () => {
      if (!createdWork) {
        return false;
      }
      const rows = await db
        .select({ publicId: taxonomyTerm.publicId })
        .from(workTaxonomyEffective)
        .innerJoin(
          taxonomyTerm,
          eq(workTaxonomyEffective.taxonomyTermId, taxonomyTerm.id)
        )
        .where(eq(workTaxonomyEffective.workId, createdWork.id));
      return rows.length === 1 && rows[0]?.publicId === seededTerm.data.id;
    }
  );

  reportAndExit();
};

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
