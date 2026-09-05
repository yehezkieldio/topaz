import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createTaxonomyTermAction } from "@/features/taxonomy/server/actions";
import { db } from "@/server/db/client";
import {
  auditLog,
  contributor,
  sourcePlatform,
  work,
  workContributor,
  workSource,
  workTaxonomyAssignment,
  workTaxonomyEffective,
} from "@/server/db/schema";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../../test/db-helpers";
// Registers the next/headers mock as a side effect -- must be imported
// before any module that transitively imports next/headers (requireAdmin),
// or that real module gets cached first and the mock never takes effect.
import { headersRef } from "../../../../test/mock-next-runtime";
import { createWorkAction } from "./create-work-action";
import {
  getWorkEditDetailAction,
  updateWorkAction,
} from "./update-work-action";

beforeEach(async () => {
  await truncateAppData();
});

const buildFormData = (overrides: Record<string, string> = {}) => {
  const formData = new FormData();
  const defaults: Record<string, string> = {
    authorName: "Original Author",
    contentRating: "general",
    publicationStatus: "in_progress",
    sortTitle: "original work",
    sourceUrl: "https://archiveofourown.org/works/original",
    taxonomyTermIds: "[]",
    title: "Original Work",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    formData.set(key, value);
  }
  return formData;
};

/**
 * updateWorkAction's return type also includes bare ServerFormState (the
 * validation-error path from createServerValidate), which has no `status`
 * field -- narrow with `in` before reading it, same as EditWorkForm does.
 */
const statusOf = (result: unknown): string | undefined =>
  result !== null && typeof result === "object" && "status" in result
    ? (result as { status: string }).status
    : undefined;

const createFixtureWork = async () => {
  const [platform] = await db
    .select({ id: sourcePlatform.publicId })
    .from(sourcePlatform)
    .limit(1);
  if (!platform) {
    throw new Error("Fixture setup: no seeded source platform.");
  }

  const formData = buildFormData({ sourcePlatformId: platform.id });
  const result = await createWorkAction(undefined, formData);
  if (!(result && "workPublicId" in result)) {
    throw new Error("Fixture setup: createWorkAction did not succeed.");
  }
  return { sourcePlatformId: platform.id, workPublicId: result.workPublicId };
};

describe("update-work-action: authorization", () => {
  it("rejects updateWorkAction for a non-admin session", async () => {
    const nonAdmin = await createTestUser("user");
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(
      updateWorkAction("nonexistent", 1, undefined, buildFormData())
    ).rejects.toThrow(/forbidden/iu);
  });

  it("rejects getWorkEditDetailAction for a non-admin session", async () => {
    const nonAdmin = await createTestUser("user");
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(getWorkEditDetailAction("nonexistent")).rejects.toThrow(
      /forbidden/iu
    );
  });
});

describe("update-work-action: admin success path", () => {
  it("updates title, source, author, and bumps the version", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const { sourcePlatformId, workPublicId } = await createFixtureWork();

    const result = await updateWorkAction(
      workPublicId,
      1,
      undefined,
      buildFormData({
        authorName: "New Author",
        sourcePlatformId,
        sourceUrl: "https://archiveofourown.org/works/updated",
        title: "Updated Title",
      })
    );

    expect(statusOf(result)).toBe("success");

    const [updated] = await db
      .select()
      .from(work)
      .where(eq(work.publicId, workPublicId))
      .limit(1);
    expect(updated?.title).toBe("Updated Title");
    expect(updated?.version).toBe(2);

    const [source] = await db
      .select()
      .from(workSource)
      .where(eq(workSource.workId, updated?.id ?? ""))
      .limit(1);
    expect(source?.url).toBe("https://archiveofourown.org/works/updated");

    const authorRows = await db
      .select({ name: contributor.name })
      .from(workContributor)
      .innerJoin(contributor, eq(contributor.id, workContributor.contributorId))
      .where(eq(workContributor.workId, updated?.id ?? ""));
    expect(authorRows).toHaveLength(1);
    expect(authorRows[0]?.name).toBe("New Author");
  });

  it("returns version-conflict without writing when the version is stale", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const { sourcePlatformId, workPublicId } = await createFixtureWork();

    const result = await updateWorkAction(
      workPublicId,
      99,
      undefined,
      buildFormData({ sourcePlatformId, title: "Should not apply" })
    );

    expect(statusOf(result)).toBe("version-conflict");

    const [row] = await db
      .select({ title: work.title, version: work.version })
      .from(work)
      .where(eq(work.publicId, workPublicId))
      .limit(1);
    expect(row?.title).toBe("Original Work");
    expect(row?.version).toBe(1);
  });

  it("assigns and unassigns taxonomy terms, rebuilding effective taxonomy", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const { sourcePlatformId, workPublicId } = await createFixtureWork();

    const term = await createTaxonomyTermAction("Found family");
    if (term.status !== "success") {
      throw new Error("Fixture setup: failed to create taxonomy term.");
    }

    const result = await updateWorkAction(
      workPublicId,
      1,
      undefined,
      buildFormData({
        sourcePlatformId,
        taxonomyTermIds: JSON.stringify([term.data.id]),
      })
    );
    expect(statusOf(result)).toBe("success");

    const [workRow] = await db
      .select({ id: work.id })
      .from(work)
      .where(eq(work.publicId, workPublicId))
      .limit(1);

    const assignments = await db
      .select()
      .from(workTaxonomyAssignment)
      .where(eq(workTaxonomyAssignment.workId, workRow?.id ?? ""));
    expect(assignments).toHaveLength(1);

    const effective = await db
      .select()
      .from(workTaxonomyEffective)
      .where(eq(workTaxonomyEffective.workId, workRow?.id ?? ""));
    expect(effective).toHaveLength(1);

    const detail = await getWorkEditDetailAction(workPublicId);
    expect(detail?.taxonomyTermIds).toEqual([term.data.id]);

    const removed = await updateWorkAction(
      workPublicId,
      2,
      undefined,
      buildFormData({ sourcePlatformId, taxonomyTermIds: "[]" })
    );
    expect(statusOf(removed)).toBe("success");

    const assignmentsAfterRemoval = await db
      .select()
      .from(workTaxonomyAssignment)
      .where(eq(workTaxonomyAssignment.workId, workRow?.id ?? ""));
    expect(assignmentsAfterRemoval).toHaveLength(0);
  });

  it("writes a bounded audit row scoped to the allow-listed columns", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const { sourcePlatformId, workPublicId } = await createFixtureWork();

    await updateWorkAction(
      workPublicId,
      1,
      undefined,
      buildFormData({ sourcePlatformId, title: "Audited Title" })
    );

    const [workRow] = await db
      .select({ id: work.id })
      .from(work)
      .where(eq(work.publicId, workPublicId))
      .limit(1);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, workRow?.id ?? ""));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityType).toBe("work");
    expect(rows[0]?.action).toBe("update-work");
    expect(Object.keys(rows[0]?.after as object).toSorted()).toEqual([
      "contentRating",
      "publicationStatus",
      "title",
    ]);
    expect(JSON.stringify(rows[0]?.after).length).toBeLessThan(500);
  });
});
