import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/client";
import { workTaxonomyAssignment } from "@/server/db/schema";

import {
  createAuthHeaders,
  createTestUser,
  truncateAppData,
} from "../../../../test/db-helpers";
import { createWorkFixture } from "../../../../test/fixtures";
// Registers the next/headers mock as a side effect -- import order matters.
import { headersRef } from "../../../../test/mock-next-runtime";
import {
  addRelationAction,
  addTermLabelAction,
  changeTermKindAction,
  createTaxonomyTermAction,
  deleteRelationAction,
  deleteTermLabelAction,
  listHotTaxonomyTermsAction,
  listTaxonomyKindsAction,
  listTermLabelsAction,
  mergeTermsAction,
  renameTermAction,
  searchTaxonomyTermsAction,
  setPrimaryTermLabelAction,
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
    ["listTaxonomyKindsAction", () => listTaxonomyKindsAction()],
    ["listTermLabelsAction", () => listTermLabelsAction("nonexistent")],
    ["addTermLabelAction", () => addTermLabelAction("nonexistent", "Alias")],
    ["deleteTermLabelAction", () => deleteTermLabelAction("nonexistent")],
    [
      "setPrimaryTermLabelAction",
      () => setPrimaryTermLabelAction("nonexistent", "nonexistent"),
    ],
    ["listHotTaxonomyTermsAction", () => listHotTaxonomyTermsAction()],
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
    if (created.status === "success") {
      expect(created.data.kind).toBe("custom");
    }

    const results = await searchTaxonomyTermsAction("dragonrider");
    expect(results.some((option) => option.label === "Dragonriders")).toBe(
      true
    );
  });

  it("creates a term under a specific kind and scopes search to it", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);

    const created = await createTaxonomyTermAction("Elves", "fandom");
    expect(created.status).toBe("success");
    if (created.status === "success") {
      expect(created.data.kind).toBe("fandom");
    }

    const scopedToFandom = await searchTaxonomyTermsAction("elve", "fandom");
    expect(scopedToFandom.some((option) => option.label === "Elves")).toBe(
      true
    );

    const scopedToCustom = await searchTaxonomyTermsAction("elve", "custom");
    expect(scopedToCustom.some((option) => option.label === "Elves")).toBe(
      false
    );
  });

  it("rejects creating a term under an unknown kind", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);

    const result = await createTaxonomyTermAction(
      "Orphan Term",
      "no-such-kind"
    );
    expect(result.status).toBe("validation-error");
  });

  it("lists a term as hot once it's assigned to a work", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);
    const { work } = await createWorkFixture(admin.id);

    const created = await createTaxonomyTermAction("Popular Term");
    if (created.status !== "success") {
      throw new Error("Fixture setup: failed to create taxonomy term.");
    }

    const initialHotTerms = await listHotTaxonomyTermsAction();
    expect(
      initialHotTerms.some((option) => option.id === created.data.id)
    ).toBe(false);

    const termRow = await db.query.taxonomyTerm.findFirst({
      where: (term, { eq }) => eq(term.publicId, created.data.id),
    });
    if (!termRow) {
      throw new Error("Fixture setup: created term not found.");
    }

    await db.insert(workTaxonomyAssignment).values({
      taxonomyTermId: termRow.id,
      workId: work.id,
    });

    const hotTerms = await listHotTaxonomyTermsAction();
    expect(hotTerms.some((option) => option.id === created.data.id)).toBe(true);
  });

  it("changes a term's kind", async () => {
    const admin = await createTestUser("admin");
    headersRef.current = await createAuthHeaders(admin.id);

    const created = await createTaxonomyTermAction("Enemies to lovers");
    expect(created.status).toBe("success");
    if (created.status !== "success") {
      return;
    }

    const kinds = await listTaxonomyKindsAction();
    expect(kinds.some((kind) => kind.slug === "custom")).toBe(true);

    const result = await changeTermKindAction(created.data.id, 1, "fandom");
    expect(result.status).toBe("success");
  });
});

const createTerm = async () => {
  const admin = await createTestUser("admin");
  headersRef.current = await createAuthHeaders(admin.id);
  const created = await createTaxonomyTermAction("Slow burn");
  if (created.status !== "success") {
    throw new Error("Fixture setup: failed to create taxonomy term.");
  }
  return created.data;
};

describe("taxonomy label Server Actions", () => {
  it("adds the first label as primary, then keeps later ones non-primary", async () => {
    const term = await createTerm();

    const first = await addTermLabelAction(term.id, "Slow-burn");
    expect(first.status).toBe("success");
    if (first.status === "success") {
      expect(first.data.isPrimary).toBe(true);
    }

    const second = await addTermLabelAction(term.id, "slowburn");
    expect(second.status).toBe("success");
    if (second.status === "success") {
      expect(second.data.isPrimary).toBe(false);
    }

    const labels = await listTermLabelsAction(term.id);
    expect(labels).toHaveLength(2);
  });

  it("rejects a duplicate label for the same term", async () => {
    const term = await createTerm();
    await addTermLabelAction(term.id, "Slow-burn");

    const result = await addTermLabelAction(term.id, "Slow-burn");
    expect(result.status).toBe("validation-error");
  });

  it("moves the primary flag when setPrimaryTermLabelAction is called", async () => {
    const term = await createTerm();
    const first = await addTermLabelAction(term.id, "Slow-burn");
    const second = await addTermLabelAction(term.id, "slowburn");
    if (first.status !== "success" || second.status !== "success") {
      throw new Error("Fixture setup: failed to add labels.");
    }

    const result = await setPrimaryTermLabelAction(term.id, second.data.id);
    expect(result.status).toBe("success");

    const labels = await listTermLabelsAction(term.id);
    const primary = labels.find((label) => label.isPrimary);
    expect(primary?.id).toBe(second.data.id);
  });

  it("deletes a label", async () => {
    const term = await createTerm();
    const added = await addTermLabelAction(term.id, "Slow-burn");
    if (added.status !== "success") {
      throw new Error("Fixture setup: failed to add label.");
    }

    const result = await deleteTermLabelAction(added.data.id);
    expect(result.status).toBe("success");
    expect(await listTermLabelsAction(term.id)).toHaveLength(0);
  });
});
