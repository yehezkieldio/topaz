import { beforeEach, describe, expect, it } from "vitest";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../test/db-helpers";
// Registers the next/headers mock as a side effect -- import order matters.
import { headersRef } from "../../../test/mock-next-runtime";
import { requireAdmin } from "./require-admin";

beforeEach(async () => {
  await truncateAppData();
});

describe("requireAdmin", () => {
  it("resolves the session for an admin user", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);

    const session = await requireAdmin();

    expect(session.user.id).toBe(admin.id);
    expect(session.user.role).toBe("admin");
  });

  it("rejects a non-admin user", async () => {
    const nonAdmin = await createTestUser("user");
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(requireAdmin()).rejects.toThrow(/forbidden/iu);
  });

  it("rejects when there is no session at all", async () => {
    headersRef.current = new Headers();

    await expect(requireAdmin()).rejects.toThrow(/forbidden/iu);
  });
});
