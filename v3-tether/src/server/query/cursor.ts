import { z } from "zod";

const cursorPayloadSchema = z.object({
  id: z.string(),
  sortBy: z.string(),
  sortOrder: z.enum(["asc", "desc"]),
  sortValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export type CursorPayload = z.infer<typeof cursorPayloadSchema>;

export const encodeCursor = (payload: CursorPayload): string =>
  Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");

/**
 * Decodes a cursor and discards it if it was minted for a different sort --
 * applying a stale cursor's (sortValue, id) pair against a new sort order
 * would silently skip or duplicate rows instead of erroring, so a mismatch
 * is treated the same as "no cursor" (start from page one).
 */
export const decodeCursor = (
  cursor: string | undefined | null,
  expected: { sortBy: string; sortOrder: "asc" | "desc" }
): CursorPayload | null => {
  if (!cursor) {
    return null;
  }

  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = cursorPayloadSchema.safeParse(JSON.parse(json));
    if (!parsed.success) {
      return null;
    }
    if (
      parsed.data.sortBy !== expected.sortBy ||
      parsed.data.sortOrder !== expected.sortOrder
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};
