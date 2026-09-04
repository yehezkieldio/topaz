import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "./cursor";
import { paginateRows } from "./paginate";

interface Row {
  id: string;
  updatedAt: string;
}

const row = (id: string, updatedAt: string): Row => ({ id, updatedAt });

const paginateOpts = {
  getId: (r: Row) => r.id,
  getSortValue: (r: Row) => r.updatedAt,
  sortBy: "updatedAt",
  sortOrder: "desc" as const,
};

describe("paginateRows", () => {
  it("returns all rows and a null cursor when under the page limit", () => {
    const rows = [row("a", "2024-01-03"), row("b", "2024-01-02")];

    const page = paginateRows(rows, 5, paginateOpts);

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it("returns an empty page with a null cursor for zero results", () => {
    const page = paginateRows([], 5, paginateOpts);

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });

  it("returns a single item unchanged when exactly one row is fetched", () => {
    const rows = [row("a", "2024-01-03")];

    const page = paginateRows(rows, 5, paginateOpts);

    expect(page.items).toEqual(rows);
    expect(page.nextCursor).toBeNull();
  });

  it("trims to the page limit and encodes a cursor at the exact boundary", () => {
    // limit+1 over-fetch pattern: 3 rows fetched for a limit of 2.
    const rows = [
      row("a", "2024-01-03"),
      row("b", "2024-01-02"),
      row("c", "2024-01-01"),
    ];

    const page = paginateRows(rows, 2, paginateOpts);

    expect(page.items).toEqual([rows[0], rows[1]]);
    expect(page.nextCursor).not.toBeNull();

    const decoded = decodeCursor(page.nextCursor, {
      sortBy: "updatedAt",
      sortOrder: "desc",
    });
    expect(decoded).toEqual({
      id: "b",
      sortBy: "updatedAt",
      sortOrder: "desc",
      sortValue: "2024-01-02",
    });
  });
});

describe("cursor encode/decode", () => {
  it("round-trips a payload", () => {
    const encoded = encodeCursor({
      id: "x",
      sortBy: "updatedAt",
      sortOrder: "asc",
      sortValue: 42,
    });

    expect(
      decodeCursor(encoded, { sortBy: "updatedAt", sortOrder: "asc" })
    ).toEqual({
      id: "x",
      sortBy: "updatedAt",
      sortOrder: "asc",
      sortValue: 42,
    });
  });

  it("discards a cursor minted for a different sort instead of misapplying it", () => {
    const encoded = encodeCursor({
      id: "x",
      sortBy: "updatedAt",
      sortOrder: "asc",
      sortValue: 42,
    });

    expect(
      decodeCursor(encoded, { sortBy: "title", sortOrder: "asc" })
    ).toBeNull();
    expect(
      decodeCursor(encoded, { sortBy: "updatedAt", sortOrder: "desc" })
    ).toBeNull();
  });

  it("treats malformed input the same as no cursor", () => {
    expect(
      decodeCursor("not-base64-json", {
        sortBy: "updatedAt",
        sortOrder: "asc",
      })
    ).toBeNull();
    expect(
      decodeCursor(undefined, { sortBy: "updatedAt", sortOrder: "asc" })
    ).toBeNull();
  });
});
