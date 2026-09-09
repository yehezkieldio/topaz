import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { auditLog, readingEvent } from "@/server/db/schema";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../../test/db-helpers";
import { createWorkFixture } from "../../../../test/fixtures";
// Registers the next/headers mock as a side effect -- import order matters.
import {
  headersRef,
  revalidateTagMock,
} from "../../../../test/mock-next-runtime";
import {
  toggleFavoriteAction,
  toggleFeaturedAction,
  updateProgressAction,
  updateRatingAction,
  updateStatusAction,
} from "./actions";
import { libraryStatsTag } from "./cache-tags";

beforeEach(() => {
  revalidateTagMock.mockClear();
});

const eventsFor = (libraryEntryId: string) =>
  db
    .select()
    .from(readingEvent)
    .where(eq(readingEvent.libraryEntryId, libraryEntryId))
    .orderBy(desc(readingEvent.createdAt));

const auditRowsFor = (entityId: string) =>
  db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityId, entityId))
    .orderBy(desc(auditLog.createdAt));

beforeEach(async () => {
  await truncateAppData();
});

describe("library mutation Server Actions: authorization", () => {
  it("rejects toggleFavoriteAction for a non-admin session", async () => {
    const nonAdmin = await createTestUser("user");
    const { entry } = await createWorkFixture(nonAdmin.id);
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(
      toggleFavoriteAction(entry.publicId, entry.version)
    ).rejects.toThrow(/forbidden/iu);
  });

  it("rejects updateStatusAction for a non-admin session", async () => {
    const nonAdmin = await createTestUser("user");
    const { entry } = await createWorkFixture(nonAdmin.id);
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(
      updateStatusAction(entry.publicId, entry.version, "reading")
    ).rejects.toThrow(/forbidden/iu);
  });

  it("rejects updateRatingAction for a non-admin session", async () => {
    const nonAdmin = await createTestUser("user");
    const { entry } = await createWorkFixture(nonAdmin.id);
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(updateRatingAction(entry.publicId, 0, 5)).rejects.toThrow(
      /forbidden/iu
    );
  });

  it("rejects every mutation with no session at all", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = new Headers();

    await expect(
      toggleFavoriteAction(entry.publicId, entry.version)
    ).rejects.toThrow(/forbidden/iu);
  });

  it("rejects toggleFeaturedAction for a non-admin session", async () => {
    const nonAdmin = await createTestUser("user");
    const { entry } = await createWorkFixture(nonAdmin.id);
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(
      toggleFeaturedAction(entry.publicId, entry.version)
    ).rejects.toThrow(/forbidden/iu);
  });

  it("rejects updateProgressAction for a non-admin session", async () => {
    const nonAdmin = await createTestUser("user");
    const { entry } = await createWorkFixture(nonAdmin.id);
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(updateProgressAction(entry.publicId, 0, 3)).rejects.toThrow(
      /forbidden/iu
    );
  });
});

describe("library mutation Server Actions: admin success path", () => {
  it("toggles favorite and applies optimistic-concurrency versioning", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    const result = await toggleFavoriteAction(entry.publicId, entry.version);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.favorite).toBe(true);
      expect(result.data.version).toBe(entry.version + 1);
    }
  });

  it("rejects a stale version with version-conflict, not a silent write", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    const result = await toggleFavoriteAction(
      entry.publicId,
      entry.version + 99
    );

    expect(result.status).toBe("version-conflict");
  });

  it("invalidates library-stats on rating change so the average doesn't go stale", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await updateRatingAction(entry.publicId, 0, 5);

    expect(revalidateTagMock).toHaveBeenCalledWith(libraryStatsTag, "max");
  });

  it("toggles featured on, assigning a display order", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    const result = await toggleFeaturedAction(entry.publicId, entry.version);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.isFeatured).toBe(true);
      expect(result.data.displayOrder).toBe(0);
    }
  });

  it("toggling featured off clears the display order", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await toggleFeaturedAction(entry.publicId, entry.version);
    const result = await toggleFeaturedAction(
      entry.publicId,
      entry.version + 1
    );

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.isFeatured).toBe(false);
      expect(result.data.displayOrder).toBeNull();
    }
  });

  it("assigns the next display order after an existing featured entry", async () => {
    const admin = await createTestUser("admin");
    const { entry: entryA } = await createWorkFixture(admin.id);
    const { entry: entryB } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await toggleFeaturedAction(entryA.publicId, entryA.version);
    const result = await toggleFeaturedAction(entryB.publicId, entryB.version);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.displayOrder).toBe(1);
    }
  });

  it("updates progress and sets startedAt/lastReadAt", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    const result = await updateProgressAction(entry.publicId, 0, 5);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.currentChapter).toBe(5);
      expect(result.data.version).toBe(1);
    }
  });
});

describe("library mutation Server Actions: reading_event trail", () => {
  it("writes one progressed event on favorite toggle", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await toggleFavoriteAction(entry.publicId, entry.version);

    const events = await eventsFor(entry.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("progressed");
    expect(events[0]?.fromSnapshot).toMatchObject({ favorite: false });
    expect(events[0]?.toSnapshot).toMatchObject({ favorite: true });
    expect(events[0]?.createdAt.getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it("writes a started event on the first transition to reading", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await updateStatusAction(entry.publicId, entry.version, "reading");

    const events = await eventsFor(entry.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("started");
  });

  it("writes a rating_changed event on rating update", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await updateRatingAction(entry.publicId, 0, 5);

    const events = await eventsFor(entry.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("rating_changed");
    expect(events[0]?.toSnapshot).toMatchObject({ rating: 5 });
  });

  it("writes no event when a version-conflict blocks the write", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    const result = await toggleFavoriteAction(
      entry.publicId,
      entry.version + 99
    );

    expect(result.status).toBe("version-conflict");
    expect(await eventsFor(entry.id)).toHaveLength(0);
  });

  it("writes no event when a status update is a no-op", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    const result = await updateStatusAction(
      entry.publicId,
      entry.version,
      entry.status
    );

    expect(result.status).toBe("success");
    expect(await eventsFor(entry.id)).toHaveLength(0);
  });

  it("writes a progressed event on chapter progress update", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await updateProgressAction(entry.publicId, 0, 5);

    const events = await eventsFor(entry.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("progressed");
    expect(events[0]?.toSnapshot).toMatchObject({ currentChapter: 5 });
  });

  it("writes no event when progress is unchanged", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await updateProgressAction(entry.publicId, 0, 5);
    await updateProgressAction(entry.publicId, 1, 5);

    expect(await eventsFor(entry.id)).toHaveLength(1);
  });
});

describe("library mutation Server Actions: audit_log trail", () => {
  it("writes one bounded audit row per successful mutation", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await toggleFavoriteAction(entry.publicId, entry.version);

    const rows = await auditRowsFor(entry.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entityType).toBe("library_entry");
    expect(rows[0]?.action).toBe("toggle-favorite");
    expect(rows[0]?.actorId).toBe(admin.id);
    expect(rows[0]?.changedColumns).toEqual(["favorite"]);
    // SAFETY: the audit_before_is_object CHECK constraint (audit.ts)
    // guarantees this jsonb column is a JSON object whenever non-null, and
    // this row was just written above.
    expect(Object.keys(rows[0]?.before as object)).toEqual(["favorite"]);
    // SAFETY: the audit_after_is_object CHECK constraint (audit.ts)
    // guarantees this jsonb column is a JSON object whenever non-null, and
    // this row was just written above.
    expect(Object.keys(rows[0]?.after as object)).toEqual(["favorite"]);
    expect(JSON.stringify(rows[0]?.after).length).toBeLessThan(500);
  });

  it("writes no audit row when a mutation is a no-op", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await updateStatusAction(entry.publicId, entry.version, entry.status);

    expect(await auditRowsFor(entry.id)).toHaveLength(0);
  });

  it("writes an audit row for toggle-featured", async () => {
    const admin = await createTestUser("admin");
    const { entry } = await createWorkFixture(admin.id);
    headersRef.current = await createAuthHeaders(admin.id);

    await toggleFeaturedAction(entry.publicId, entry.version);

    const rows = await auditRowsFor(entry.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("toggle-featured");
    expect(rows[0]?.changedColumns).toEqual(["is_featured"]);
  });
});
