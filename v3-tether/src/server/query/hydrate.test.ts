import { describe, expect, it, vi } from "vitest";

import { hydrateByParent } from "./hydrate";

interface Child {
  parentId: string;
  label: string;
}

describe("hydrateByParent", () => {
  it("returns an empty map without calling fetchChildren for no parents", async () => {
    const fetchChildren = vi.fn();

    const result = await hydrateByParent([], fetchChildren);

    expect(result.size).toBe(0);
    expect(fetchChildren).not.toHaveBeenCalled();
  });

  it("groups children by parentId", async () => {
    const rows: Child[] = [
      { label: "a1", parentId: "a" },
      { label: "a2", parentId: "a" },
      { label: "b1", parentId: "b" },
    ];
    const fetchChildren = vi.fn().mockResolvedValue(rows);

    const result = await hydrateByParent(["a", "b"], fetchChildren);

    expect(fetchChildren).toHaveBeenCalledWith(["a", "b"]);
    expect(result.get("a")).toEqual([
      { label: "a1", parentId: "a" },
      { label: "a2", parentId: "a" },
    ]);
    expect(result.get("b")).toEqual([{ label: "b1", parentId: "b" }]);
  });

  it("omits parents with no matching children entirely, rather than an empty array", async () => {
    const fetchChildren = vi.fn().mockResolvedValue([]);

    const result = await hydrateByParent(["a"], fetchChildren);

    expect(result.has("a")).toBe(false);
  });
});
