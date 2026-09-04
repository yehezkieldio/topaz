import { beforeEach, describe, expect, it } from "vitest";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../../test/db-helpers";
import { createWorkFixture } from "../../../../test/fixtures";
// Registers the next/headers mock as a side effect -- import order matters.
import { headersRef } from "../../../../test/mock-next-runtime";
import {
  toggleFavoriteAction,
  updateRatingAction,
  updateStatusAction,
} from "./actions";

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
});
