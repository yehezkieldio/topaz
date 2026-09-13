import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { enumCheck } from "./_shared";
import { publicationStatusValues, work, workSource } from "./catalog";

export const workSourceObservationSourceValues = [
  "manual",
  "refresh",
  "import",
] as const;
export type WorkSourceObservationSource =
  (typeof workSourceObservationSourceValues)[number];

/**
 * Append-only, insert-only-on-change time series. No publicId, no updatedAt
 * -- high-volume log tables skip idColumns()/timestampColumns() deliberately
 * to keep rows near ~64 bytes (v3-tether/plan-work.md Design Principle 2).
 */
export const workSourceObservation = sqliteTable(
  "work_source_observation",
  {
    chapterCount: integer("chapter_count"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    publicationStatus: text("publication_status", {
      enum: publicationStatusValues,
    }),
    source: text("source", { enum: workSourceObservationSourceValues })
      .notNull()
      .default("manual"),
    wordCount: integer("word_count"),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    workSourceId: text("work_source_id")
      .notNull()
      .references(() => workSource.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("wso_source_time_idx").on(t.workSourceId, t.createdAt),
    // BRIN has no SQLite equivalent -- there's no storage-order-correlated
    // block index concept in SQLite, and at this app's row volume a plain
    // btree on createdAt (already covered by wso_source_time_idx's leading
    // column ordering for the common per-source query) is cheap enough that
    // introducing anything BRIN-like isn't worth the complexity.
    check("wso_word_count_non_negative", sql`${t.wordCount} >= 0`),
    check("wso_chapter_count_non_negative", sql`${t.chapterCount} >= 0`),
    enumCheck(
      "wso_publication_status_valid",
      t.publicationStatus,
      publicationStatusValues
    ),
    enumCheck("wso_source_valid", t.source, workSourceObservationSourceValues),
  ]
);
