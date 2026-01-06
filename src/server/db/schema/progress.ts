import { relations, sql } from "drizzle-orm";
import { check, index, pgEnum, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import z4 from "zod/v4";
import { stories } from "#/server/db/schema/story";
import { users } from "#/server/db/schema/user";
import { createTable, ids, timestamps } from "#/server/db/utils";

export const progressStatusEnum = pgEnum("reading_status", [
    "NotStarted",
    "Reading",
    "Paused",
    "Completed",
    "Dropped",
    "PlanToRead",
    "DroppedAsAbandoned",
]);

export const progressStatusLabels: Record<ProgressStatus, string> = {
    NotStarted: "Not Started",
    Reading: "Reading",
    Paused: "Paused",
    Completed: "Completed",
    Dropped: "Dropped",
    PlanToRead: "PlanToRead",
    DroppedAsAbandoned: "Dropped as Abandoned",
};

export type ProgressStatus = (typeof progressStatusEnum.enumValues)[number];

export const progressSortByEnum = z4.enum([
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

export type ProgressSortBy = z4.infer<typeof progressSortByEnum>;

export const progresses = createTable(
    "progress",
    (d) => ({
        ...ids,
        userId: uuid()
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        storyId: uuid()
            .notNull()
            .references(() => stories.id, { onDelete: "cascade" }),
        status: progressStatusEnum("reading_status").notNull().default("Reading"),
        current_chapter: d.integer().notNull().default(0),
        rating: d.numeric({ precision: 2, scale: 1 }).notNull().default("0.0"),
        notes: d.text(),
        version: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        check("rating between 0 and 5", sql`${t.rating} >= 0 AND ${t.rating} <= 5`),
        uniqueIndex("prog_pid_uidx").on(t.publicId).concurrently(),
        uniqueIndex("prog_user_story_uidx").on(t.userId, t.storyId).concurrently(),
        index("prog_user_status_idx").on(t.userId, t.status).concurrently(),
        index("prog_user_idx").on(t.userId).concurrently(),
        index("prog_story_idx").on(t.storyId).concurrently(),
        index("prog_status_idx").on(t.status).concurrently(),
        index("prog_updated_idx").on(t.updated_at).concurrently(),
        index("prog_created_idx").on(t.created_at).concurrently(),
    ],
);

export const progressRelations = relations(progresses, ({ one }) => ({
    user: one(users, {
        fields: [progresses.userId],
        references: [users.id],
        relationName: "progress_user_relation",
    }),
    story: one(stories, {
        fields: [progresses.storyId],
        references: [stories.id],
        relationName: "progress_story_relation",
    }),
}));

export const progressCreateSchema = createInsertSchema(progresses);
export const progressUpdateSchema = createUpdateSchema(progresses);
export type ProgressValues = z4.infer<typeof progressCreateSchema>;
