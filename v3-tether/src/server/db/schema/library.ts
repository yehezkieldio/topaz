import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { idColumns, timestampColumns } from "./_shared";
import { user } from "./auth";
import { work } from "./catalog";

export const libraryEntryStatusEnum = pgEnum("library_entry_status", [
  "not_started",
  "reading",
  "paused",
  "completed",
  "dropped",
  "plan_to_read",
  "dropped_as_abandoned",
  "completed_as_axed",
]);

export const readingEventTypeEnum = pgEnum("reading_event_type", [
  "started",
  "progressed",
  "rating_changed",
  "reread_started",
  "status_changed",
  "completed",
  "dropped",
]);

export const libraryEntry = pgTable(
  "library_entry",
  {
    ...idColumns(),
    displayOrder: integer("display_order"),
    favorite: boolean("favorite").default(false).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),
    priority: integer("priority"),
    private: boolean("private").default(false).notNull(),
    status: libraryEntryStatusEnum("status").default("not_started").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    workId: uuid("work_id")
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
  ]
);

export const readingState = pgTable(
  "reading_state",
  {
    completedAt: timestamp("completed_at"),
    currentChapter: integer("current_chapter"),
    lastReadAt: timestamp("last_read_at"),
    libraryEntryId: uuid("library_entry_id")
      .primaryKey()
      .references(() => libraryEntry.id, { onDelete: "cascade" }),
    percent: numeric("percent", { precision: 5, scale: 2 }),
    rating: numeric("rating", { mode: "number", precision: 3, scale: 1 }),
    rereadCount: integer("reread_count").default(0).notNull(),
    startedAt: timestamp("started_at"),
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

export const readingEvent = pgTable(
  "reading_event",
  {
    ...idColumns(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    eventType: readingEventTypeEnum("event_type").notNull(),
    fromSnapshot: jsonb("from_snapshot"),
    libraryEntryId: uuid("library_entry_id")
      .notNull()
      .references(() => libraryEntry.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    toSnapshot: jsonb("to_snapshot"),
  },
  (table) => [
    index("reading_event_library_entry_id_idx").on(table.libraryEntryId),
    index("reading_event_created_at_idx").on(table.createdAt),
    check(
      "reading_event_metadata_is_object",
      sql`${table.metadata} is null or jsonb_typeof(${table.metadata}) = 'object'`
    ),
  ]
);
