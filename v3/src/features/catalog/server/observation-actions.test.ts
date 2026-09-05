import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { auditLog, work, workSourceObservation } from "@/server/db/schema";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../../test/db-helpers";
import { createWorkFixture } from "../../../../test/fixtures";
// Registers the next/headers mock as a side effect -- import order matters.
import { headersRef } from "../../../../test/mock-next-runtime";
import { recordSourceObservationAction } from "./observation-actions";

beforeEach(async () => {
  await truncateAppData();
});

const observationsFor = (workSourceId: string) =>
  db
    .select()
    .from(workSourceObservation)
    .where(eq(workSourceObservation.workSourceId, workSourceId));

const setup = async () => {
  const admin = await createTestUser("admin");
  const { work: createdWork } = await createWorkFixture(admin.id);
  headersRef.current = await createAuthHeaders(admin.id);

  const [source] = await db.query.workSource.findMany({
    limit: 1,
    where: (workSourceTable, { eq: equals }) =>
      equals(workSourceTable.workId, createdWork.id),
  });

  if (!source) {
    throw new Error("Fixture setup: expected a work_source row.");
  }

  return { source, workId: createdWork.id };
};

describe("recordSourceObservationAction", () => {
  it("writes one row when counts change", async () => {
    const { source } = await setup();

    const result = await recordSourceObservationAction(source.publicId, {
      chapterCount: 5,
      publicationStatus: "in_progress",
      wordCount: 10_000,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.status).toBe("recorded");
    }
    expect(await observationsFor(source.id)).toHaveLength(1);
  });

  it("writes nothing when the reported counts are unchanged", async () => {
    const { source } = await setup();
    const counts = {
      chapterCount: 5,
      publicationStatus: "in_progress" as const,
      wordCount: 10_000,
    };

    await recordSourceObservationAction(source.publicId, counts);
    const result = await recordSourceObservationAction(source.publicId, counts);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.status).toBe("noop");
    }
    expect(await observationsFor(source.id)).toHaveLength(1);
  });

  it("also updates the denormalized work_source counts on change", async () => {
    const { source } = await setup();

    await recordSourceObservationAction(source.publicId, {
      chapterCount: 12,
      publicationStatus: "completed",
      wordCount: 42_000,
    });

    const [updated] = await db.query.workSource.findMany({
      limit: 1,
      where: (workSourceTable, { eq: equals }) =>
        equals(workSourceTable.id, source.id),
    });

    expect(updated?.chapterCount).toBe(12);
    expect(updated?.wordCount).toBe(42_000);
  });

  it("cascades delete: removing the work drops its observations", async () => {
    const { source, workId } = await setup();

    await recordSourceObservationAction(source.publicId, {
      chapterCount: 5,
      publicationStatus: "in_progress",
      wordCount: 10_000,
    });
    expect(await observationsFor(source.id)).toHaveLength(1);

    await db.delete(work).where(eq(work.id, workId));

    expect(await observationsFor(source.id)).toHaveLength(0);
  });

  it("writes one bounded audit row when counts change, none on no-op", async () => {
    const { source } = await setup();
    const counts = {
      chapterCount: 5,
      publicationStatus: "in_progress" as const,
      wordCount: 10_000,
    };

    await recordSourceObservationAction(source.publicId, counts);
    await recordSourceObservationAction(source.publicId, counts);

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, source.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityType).toBe("work_source");
    expect(rows[0]?.action).toBe("record-observation");
    expect(JSON.stringify(rows[0]?.after).length).toBeLessThan(500);
  });
});
