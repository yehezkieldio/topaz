import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { enumCheck, idColumns, jsonText, timestampColumns } from "./_shared";
import { user } from "./auth";
import { work } from "./catalog";

export const libraryEntryStatusValues = [
  "not_started",
  "reading",
  "paused",
  "completed",
  "dropped",
  "plan_to_read",
  "dropped_as_abandoned",
  "completed_as_axed",
] as const;
export type LibraryEntryStatus = (typeof libraryEntryStatusValues)[number];

export const readingEventTypeValues = [
  "started",
  "progressed",
  "rating_changed",
  "reread_started",
  "status_changed",
  "completed",
  "dropped",
] as const;
export type ReadingEventType = (typeof readingEventTypeValues)[number];

export const libraryEntry = sqliteTable(
  "library_entry",
  {
    ...idColumns(),
    displayOrder: integer("display_order"),
    favorite: integer("favorite", { mode: "boolean" }).default(false).notNull(),
    isFeatured: integer("is_featured", { mode: "boolean" })
      .default(false)
      .notNull(),
    priority: integer("priority"),
    private: integer("private", { mode: "boolean" }).default(false).notNull(),
    status: text("status", { enum: libraryEntryStatusValues })
      .default("not_started")
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("library_entry_user_work_uidx").on(table.userId, table.workId),
    index("library_entry_status_idx").on(table.status),
    index("library_entry_favorite_idx")
      .on(table.userId)
      .where(sql`${table.favorite} = true`),
    index("library_entry_display_order_idx")
      .on(table.isFeatured, table.displayOrder)
      .where(sql`${table.isFeatured} = true`),
    enumCheck("library_entry_status_valid", table.status, libraryEntryStatusValues),
  ]
);

export const readingState = sqliteTable(
  "reading_state",
  {
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    currentChapter: integer("current_chapter"),
    lastReadAt: integer("last_read_at", { mode: "timestamp_ms" }),
    libraryEntryId: text("library_entry_id")
      .primaryKey()
      .references(() => libraryEntry.id, { onDelete: "cascade" }),
    // numeric(precision, scale) has no SQLite equivalent -- real, with the
    // existing range/step CHECK doing the precision enforcement that a
    // Postgres numeric column type gave for free.
    percent: real("percent"),
    rating: real("rating"),
    rereadCount: integer("reread_count").default(0).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    version: integer("version").default(1).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    check(
      "reading_state_rating_range",
      sql`${table.rating} is null or (${table.rating} >= 1 and ${table.rating} <= 10 and (${table.rating} * 2) = floor(${table.rating} * 2))`
    ),
  ]
);

export const readingEvent = sqliteTable(
  "reading_event",
  {
    ...idColumns(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    eventType: text("event_type", { enum: readingEventTypeValues }).notNull(),
    fromSnapshot: jsonText<Record<string, unknown>>("from_snapshot"),
    libraryEntryId: text("library_entry_id")
      .notNull()
      .references(() => libraryEntry.id, { onDelete: "cascade" }),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    toSnapshot: jsonText<Record<string, unknown>>("to_snapshot"),
  },
  (table) => [
    index("reading_event_library_entry_id_idx").on(table.libraryEntryId),
    index("reading_event_created_at_idx").on(table.createdAt),
    check(
      "reading_event_metadata_is_object",
      sql`${table.metadata} is null or (json_valid(${table.metadata}) and json_type(${table.metadata}) = 'object')`
    ),
    enumCheck(
      "reading_event_event_type_valid",
      table.eventType,
      readingEventTypeValues
    ),
  ]
);
