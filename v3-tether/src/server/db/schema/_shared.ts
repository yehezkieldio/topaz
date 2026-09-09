import { createId } from "@paralleldrive/cuid2";
import { customType, integer, text } from "drizzle-orm/sqlite-core";

/**
 * Case-insensitive text (03_data/00_schema_contract.md's citext -> SQLite
 * translation). COLLATE NOCASE is part of the column's declared type, not a
 * runtime lower()/cast at query time -- an index on this column matches the
 * exact declared expression, same discipline the schema contract already
 * requires for trigram/FTS indexes. Accepted tradeoff: NOCASE folds ASCII
 * case only, not full Unicode case-folding the way citext's ICU-backed
 * comparison did -- fine for this library's actual (English-language) content.
 */
export const nocaseText = customType<{ data: string }>({
  dataType() {
    return "text collate nocase";
  },
});

/**
 * JSON-shaped text (03_data/00_schema_contract.md's jsonb -> SQLite
 * translation). Enforced as valid JSON at the database level via a CHECK
 * constraint declared alongside the column in each table, not just at the
 * application boundary -- see catalog.ts's raw_metadata for the pattern.
 * Read/written through Drizzle's json mode, never passed through as an
 * unvalidated string.
 */
export const jsonText = <TData>(name: string) =>
  text(name, { mode: "json" }).$type<TData>();

/**
 * Factory, not a shared object -- every sqliteTable() call must get its own
 * column-builder instances. Spreading a module-scope singleton here would
 * hand every table the *same* `publicId` builder, and Drizzle would then
 * derive the same unique-constraint name for every table that uses it.
 */
export const idColumns = () => ({
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  publicId: text("public_id")
    .notNull()
    .unique()
    .$defaultFn(() => createId()),
});

export const timestampColumns = () => ({
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});
