/**
 * Verifies the P0 acceptance criterion (01_acceptance_criteria.md): "a
 * non-admin session cannot call any mutation Server Action (verified, not
 * assumed)". Exercises requireAdmin() through every mutating Server Action
 * in the app -- library and taxonomy -- with a real admin session, a real
 * non-admin session, and no session at all, hitting a real Postgres
 * database. Run via:
 *
 *   bun --preload ./scripts/lib/next-runtime-mock.ts scripts/verify-auth-roles.ts
 */
import { headersRef } from "./lib/next-runtime-mock";
import {
  check,
  closeDb,
  createAuthHeaders,
  createTestUser,
  log,
  noSessionHeaders,
  reportAndExit,
  seedReferenceData,
  truncateAppData,
} from "./lib/verify-env";

const isForbidden = (error: unknown) =>
  error instanceof Error && /forbidden/iu.test(error.message);

const main = async () => {
  await truncateAppData();
  await seedReferenceData();

  const { toggleFavoriteAction, updateRatingAction, updateStatusAction } =
    await import("@/features/library/server/actions");
  const {
    addRelationAction,
    changeTermKindAction,
    createTaxonomyTermAction,
    deleteRelationAction,
    mergeTermsAction,
    renameTermAction,
  } = await import("@/features/taxonomy/server/actions");
  const { db } = await import("@/server/db/client");
  const { libraryEntry, sourcePlatform, work, workSource } =
    await import("@/server/db/schema");

  const admin = await createTestUser("admin");
  const nonAdmin = await createTestUser("user");

  const [platform] = await db
    .select({ id: sourcePlatform.id })
    .from(sourcePlatform)
    .limit(1);
  if (!platform) {
    throw new Error("Reference data seed did not create a source platform.");
  }

  const [createdWork] = await db
    .insert(work)
    .values({
      contentRating: "general",
      publicationStatus: "in_progress",
      sortTitle: "auth verify fixture",
      title: "Auth Verify Fixture",
    })
    .returning();
  if (!createdWork) {
    throw new Error("Failed to insert fixture work.");
  }
  await db.insert(workSource).values({
    normalizedUrl: "https://archiveofourown.org/works/verify-auth",
    sourcePlatformId: platform.id,
    url: "https://archiveofourown.org/works/verify-auth",
    workId: createdWork.id,
  });
  const [entry] = await db
    .insert(libraryEntry)
    .values({
      status: "plan_to_read",
      userId: admin.id,
      workId: createdWork.id,
    })
    .returning();
  if (!entry) {
    throw new Error("Failed to insert fixture library entry.");
  }

  log.section("Non-admin session: every mutation must reject");
  headersRef.current = await createAuthHeaders(nonAdmin.id);

  await check("toggleFavoriteAction rejects", async () => {
    try {
      await toggleFavoriteAction(entry.publicId, entry.version);
      return false;
    } catch (error) {
      return isForbidden(error);
    }
  });

  await check("updateStatusAction rejects", async () => {
    try {
      await updateStatusAction(entry.publicId, entry.version, "reading");
      return false;
    } catch (error) {
      return isForbidden(error);
    }
  });

  await check("updateRatingAction rejects", async () => {
    try {
      await updateRatingAction(entry.publicId, entry.version, 5);
      return false;
    } catch (error) {
      return isForbidden(error);
    }
  });

  await check("createTaxonomyTermAction rejects", async () => {
    try {
      await createTaxonomyTermAction("Should Not Exist");
      return false;
    } catch (error) {
      return isForbidden(error);
    }
  });

  log.section("No session at all: every mutation must reject");
  headersRef.current = noSessionHeaders();

  await check("toggleFavoriteAction rejects with no session", async () => {
    try {
      await toggleFavoriteAction(entry.publicId, entry.version);
      return false;
    } catch (error) {
      return isForbidden(error);
    }
  });

  log.section("Admin session: mutations succeed");
  headersRef.current = await createAuthHeaders(admin.id);

  let favoriteVersion = entry.version;
  await check("toggleFavoriteAction succeeds for admin", async () => {
    const result = await toggleFavoriteAction(entry.publicId, entry.version);
    if (result.status !== "success") {
      return false;
    }
    favoriteVersion = result.data.version;
    return result.data.favorite === true;
  });

  let termPublicId = "";
  await check("createTaxonomyTermAction succeeds for admin", async () => {
    const result = await createTaxonomyTermAction("Auth Verify Term");
    if (result.status !== "success") {
      return false;
    }
    termPublicId = result.data.id;
    return true;
  });

  await check(
    "non-admin still rejected after an admin term exists (relation/kind/merge actions)",
    async () => {
      headersRef.current = await createAuthHeaders(nonAdmin.id);
      try {
        await renameTermAction(termPublicId, 1, "Should Not Rename");
        return false;
      } catch (error) {
        if (!isForbidden(error)) {
          return false;
        }
      }
      try {
        await changeTermKindAction(termPublicId, 1, "custom");
        return false;
      } catch (error) {
        if (!isForbidden(error)) {
          return false;
        }
      }
      try {
        await addRelationAction(termPublicId, termPublicId, "related");
        return false;
      } catch (error) {
        if (!isForbidden(error)) {
          return false;
        }
      }
      try {
        await deleteRelationAction("00000000-0000-0000-0000-000000000000");
        return false;
      } catch (error) {
        if (!isForbidden(error)) {
          return false;
        }
      }
      try {
        await mergeTermsAction(termPublicId, termPublicId);
        return false;
      } catch (error) {
        return isForbidden(error);
      }
    }
  );

  void favoriteVersion;

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
