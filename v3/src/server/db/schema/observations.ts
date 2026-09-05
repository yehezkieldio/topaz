import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { publicationStatusEnum, work, workSource } from "./catalog";

/**
 * Append-only, insert-only-on-change time series. No publicId, no updatedAt
 * -- high-volume log tables skip idColumns()/timestampColumns() deliberately
 * to keep rows near ~64 bytes (v3/plan-work.md Design Principle 2).
 */
export const workSourceObservation = pgTable(
  "work_source_observation",
  {
    chapterCount: integer("chapter_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    publicationStatus: publicationStatusEnum("publication_status"),
    source: text("source", { enum: ["manual", "refresh", "import"] })
      .notNull()
      .default("manual"),
    wordCount: integer("word_count"),
    workId: uuid("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    workSourceId: uuid("work_source_id")
      .notNull()
      .references(() => workSource.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("wso_source_time_idx").on(t.workSourceId, t.createdAt),
    // BRIN keeps time-range scans cheap on Free tier for append-only data.
    index("wso_created_brin_idx").using("brin", t.createdAt),
    check("wso_word_count_non_negative", sql`${t.wordCount} >= 0`),
    check("wso_chapter_count_non_negative", sql`${t.chapterCount} >= 0`),
  ]
);
