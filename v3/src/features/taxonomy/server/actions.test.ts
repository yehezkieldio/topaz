import { beforeEach, describe, expect, it } from "vitest";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../../test/db-helpers";
// Registers the next/headers mock as a side effect -- import order matters.
import { headersRef } from "../../../../test/mock-next-runtime";
import {
  addRelationAction,
  changeTermKindAction,
  createTaxonomyTermAction,
  deleteRelationAction,
  mergeTermsAction,
  renameTermAction,
  searchTaxonomyTermsAction,
} from "./actions";

beforeEach(async () => {
  await truncateAppData();
});

/**
 * Every mutating taxonomy action calls requireAdmin() before touching the
 * DB, so a bogus target id is enough to prove the reject happens up front --
 * these are authorization tests, not fixture tests.
 */
describe("taxonomy Server Actions: authorization", () => {
  it.each([
    ["searchTaxonomyTermsAction", () => searchTaxonomyTermsAction("dragon")],
    ["createTaxonomyTermAction", () => createTaxonomyTermAction("Dragons")],
    [
      "renameTermAction",
      () => renameTermAction("nonexistent", 1, "Dragons II"),
    ],
    [
      "changeTermKindAction",
      () => changeTermKindAction("nonexistent", 1, "custom"),
    ],
    [
      "addRelationAction",
      () => addRelationAction("nonexistent-a", "nonexistent-b", "related"),
    ],
    ["deleteRelationAction", () => deleteRelationAction("nonexistent")],
    ["mergeTermsAction", () => mergeTermsAction("winner", "loser")],
  ])("%s rejects a non-admin session", async (_name, invoke) => {
    const nonAdmin = await createTestUser("user");
    headersRef.current = await createAuthHeaders(nonAdmin.id);

    await expect(invoke()).rejects.toThrow(/forbidden/iu);
  });

  it("rejects mergeTermsAction with no session at all", async () => {
    headersRef.current = new Headers();

    await expect(mergeTermsAction("winner", "loser")).rejects.toThrow(
      /forbidden/iu
    );
  });
});

describe("taxonomy Server Actions: admin success path", () => {
  it("creates a term and lets an admin search for it via trigram similarity", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);

    const created = await createTaxonomyTermAction("Dragonriders");
    expect(created.status).toBe("success");

    const results = await searchTaxonomyTermsAction("dragonrider");
    expect(results.some((option) => option.label === "Dragonriders")).toBe(
      true
    );
  });
});
