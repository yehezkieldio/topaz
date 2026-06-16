import { relations, sql } from "drizzle-orm";
import { check, index, jsonb, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "#/server/db/schema/user";
import { works } from "#/server/db/schema/work";
import { createTable, ids, timestamps } from "#/server/db/utils";

export const libraryEntryStatusEnum = z.enum([
    "NotStarted",
    "Reading",
    "Paused",
    "Completed",
    "Dropped",
    "PlanToRead",
    "DroppedAsAbandoned",
]);
export type LibraryEntryStatus = z.infer<typeof libraryEntryStatusEnum>;

export const libraryEntryStatusLabels: Record<LibraryEntryStatus, string> = {
    NotStarted: "Not Started",
    Reading: "Reading",
    Paused: "Paused",
    Completed: "Completed",
    Dropped: "Dropped",
    PlanToRead: "PlanToRead",
    DroppedAsAbandoned: "Dropped as Abandoned",
};

export const readingEventTypeEnum = z.enum([
    "added",
    "started",
    "progressed",
    "paused",
    "resumed",
    "completed",
    "dropped",
    "rating_changed",
    "note_changed",
    "reread_started",
    "reread_completed",
]);
export type ReadingEventType = z.infer<typeof readingEventTypeEnum>;
export const readingEventTypes = readingEventTypeEnum.options;

export const librarySortByEnum = z.enum([
    "title",
    "author",
    "status",
    "rating",
    "progress",
    "updatedAt",
    "createdAt",
    "wordCount",
    "chapterCount",
    "isNsfw",
]);
export type LibrarySortBy = z.infer<typeof librarySortByEnum>;

export const libraryEntries = createTable(
    "library_entry",
    (d) => ({
        ...ids,
        userId: uuid()
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        workId: uuid()
            .notNull()
            .references(() => works.id, { onDelete: "cascade" }),
        status: d.text().notNull().default("Reading"),
        favorite: d.boolean().notNull().default(false),
        priority: d.integer().notNull().default(0),
        private: d.boolean().notNull().default(false),
        added_at: d.timestamp({ mode: "date", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
        archived_at: d.timestamp({ mode: "date", withTimezone: true }),
        version: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("library_entry_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("library_entry_user_work_uidx").on(t.userId, t.workId).concurrently(),
        index("library_entry_user_idx").on(t.userId).concurrently(),
        index("library_entry_work_idx").on(t.workId).concurrently(),
        index("library_entry_user_status_idx").on(t.userId, t.status).concurrently(),
        index("library_entry_user_updated_idx").on(t.userId, t.updated_at).concurrently(),
    ]
);

export const readingStates = createTable(
    "reading_state",
    (d) => ({
        ...ids,
        libraryEntryId: uuid()
            .notNull()
            .references(() => libraryEntries.id, { onDelete: "cascade" }),
        current_chapter: d.integer().notNull().default(0),
        current_percent: d.numeric({ precision: 5, scale: 2, mode: "number" }),
        rating: d.numeric({ precision: 2, scale: 1, mode: "number" }),
        notes: d.text(),
        started_at: d.timestamp({ mode: "date", withTimezone: true }),
        finished_at: d.timestamp({ mode: "date", withTimezone: true }),
        last_read_at: d.timestamp({ mode: "date", withTimezone: true }),
        reread_count: d.integer().notNull().default(0),
        version: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("reading_state_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("reading_state_library_entry_uidx").on(t.libraryEntryId).concurrently(),
        index("reading_state_library_entry_idx").on(t.libraryEntryId).concurrently(),
        check("reading_state_rating_range", sql`${t.rating} IS NULL OR (${t.rating} >= 0 AND ${t.rating} <= 5)`),
        check(
            "reading_state_current_percent_range",
            sql`${t.current_percent} IS NULL OR (${t.current_percent} >= 0 AND ${t.current_percent} <= 100)`
        ),
        check("reading_state_current_chapter_nonnegative", sql`${t.current_chapter} >= 0`),
        check("reading_state_reread_count_nonnegative", sql`${t.reread_count} >= 0`),
    ]
);

export const readingEvents = createTable(
    "reading_event",
    (d) => ({
        ...ids,
        libraryEntryId: uuid()
            .notNull()
            .references(() => libraryEntries.id, { onDelete: "cascade" }),
        event_type: d.text().notNull(),
        from_status: d.text(),
        to_status: d.text(),
        from_chapter: d.integer(),
        to_chapter: d.integer(),
        from_rating: d.numeric({ precision: 2, scale: 1, mode: "number" }),
        to_rating: d.numeric({ precision: 2, scale: 1, mode: "number" }),
        event_at: d.timestamp({ mode: "date", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
        note: d.text(),
        metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
        created_at: d.timestamp({ mode: "date", withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    }),
    (t) => [
        uniqueIndex("reading_event_public_id_uidx").on(t.publicId).concurrently(),
        index("reading_event_library_entry_idx").on(t.libraryEntryId).concurrently(),
        index("reading_event_event_at_idx").on(t.event_at).concurrently(),
        index("reading_event_library_entry_event_at_idx").on(t.libraryEntryId, t.event_at).concurrently(),
        check("reading_event_metadata_object", sql`jsonb_typeof(${t.metadata}) = 'object'`),
        check("reading_event_from_chapter_nonnegative", sql`${t.from_chapter} IS NULL OR ${t.from_chapter} >= 0`),
        check("reading_event_to_chapter_nonnegative", sql`${t.to_chapter} IS NULL OR ${t.to_chapter} >= 0`),
        check(
            "reading_event_from_rating_range",
            sql`${t.from_rating} IS NULL OR (${t.from_rating} >= 0 AND ${t.from_rating} <= 5)`
        ),
        check(
            "reading_event_to_rating_range",
            sql`${t.to_rating} IS NULL OR (${t.to_rating} >= 0 AND ${t.to_rating} <= 5)`
        ),
    ]
);

export const libraryEntriesRelations = relations(libraryEntries, ({ one }) => ({
    user: one(users, {
        fields: [libraryEntries.userId],
        references: [users.id],
        relationName: "library_entry_user_relation",
    }),
    work: one(works, {
        fields: [libraryEntries.workId],
        references: [works.id],
        relationName: "library_entry_work_relation",
    }),
}));

export const readingStatesRelations = relations(readingStates, ({ one }) => ({
    libraryEntry: one(libraryEntries, {
        fields: [readingStates.libraryEntryId],
        references: [libraryEntries.id],
    }),
}));

export const readingEventsRelations = relations(readingEvents, ({ one }) => ({
    libraryEntry: one(libraryEntries, {
        fields: [readingEvents.libraryEntryId],
        references: [libraryEntries.id],
    }),
}));

export const libraryEntryCreateSchema = createInsertSchema(libraryEntries);
export const libraryEntryUpdateSchema = createUpdateSchema(libraryEntries).required({ publicId: true });
export const readingStateCreateSchema = createInsertSchema(readingStates);
export const readingStateUpdateSchema = createUpdateSchema(readingStates);
export const readingEventCreateSchema = createInsertSchema(readingEvents);
