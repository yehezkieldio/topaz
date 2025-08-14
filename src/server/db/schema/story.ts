import { relations } from "drizzle-orm";
import { index, pgEnum, primaryKey, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import z from "zod/v4";
import { fandoms } from "#/server/db/schema/fandom";
import { progressStatusEnum } from "#/server/db/schema/progress";
import { tags } from "#/server/db/schema/tag";
import { citext, createTable, ids, timestamps } from "#/server/db/utils";

export const sourceEnum = pgEnum("source", [
    "ArchiveOfOurOwn",
    "FanFictionNet",
    "Wattpad",
    "SpaceBattles",
    "SufficientVelocity",
    "QuestionableQuesting",
    "RoyalRoad",
    "WebNovel",
    "ScribbleHub",
    "NovelBin",
    "Other",
]);
export type Source = (typeof sourceEnum.enumValues)[number];

export const sourceLabels = {
    ArchiveOfOurOwn: "Archive of Our Own",
    Wattpad: "Wattpad",
    SpaceBattles: "SpaceBattles",
    SufficientVelocity: "Sufficient Velocity",
    QuestionableQuesting: "Questionable Questing",
    FanFictionNet: "FanFiction.Net",
    RoyalRoad: "Royal Road",
    WebNovel: "WebNovel",
    ScribbleHub: "ScribbleHub",
    NovelBin: "NovelBin",
    Other: "Other",
} satisfies Record<Source, string>;

export const sourceShortLabels = {
    ArchiveOfOurOwn: "AO3",
    Wattpad: "Wattpad",
    SpaceBattles: "SB",
    SufficientVelocity: "SV",
    QuestionableQuesting: "QQ",
    FanFictionNet: "FFN",
    RoyalRoad: "RR",
    WebNovel: "WN",
    ScribbleHub: "SH",
    NovelBin: "NB",
    Other: "Other",
} satisfies Record<Source, string>;

export const storyStatusEnum = pgEnum("story_status", ["Ongoing", "Completed", "Hiatus", "Abandoned"]);
export type StoryStatus = (typeof storyStatusEnum.enumValues)[number];

export const storyStatusLabels = {
    Ongoing: "Ongoing",
    Completed: "Completed",
    Hiatus: "Hiatus",
    Abandoned: "Abandoned",
} satisfies Record<StoryStatus, string>;

export const stories = createTable(
    "story",
    (d) => ({
        ...ids,
        author: citext().notNull().default("Unknown"),
        chapter_count: d.integer(),
        description: citext(),
        is_nsfw: d.boolean().notNull().default(false),
        word_count: d.integer(),
        source: sourceEnum("source").notNull().default("Other"),
        status: storyStatusEnum("status").notNull().default("Ongoing"),
        summary: citext(),
        title: citext().notNull(),
        url: d.text().notNull(),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("story_pid_uidx").on(t.publicId).concurrently(),
        index("story_source_status_idx").on(t.source, t.status).concurrently(),
        index("story_created_idx").on(t.created_at).concurrently(),
        index("story_updated_idx").on(t.updated_at).concurrently(),
    ],
);

export const storyCreateSchema = createInsertSchema(stories).extend({
    tagIds: z.array(z.string()).default([]),
    fandomIds: z.array(z.string()).default([]),
});
export const storyUpdateSchema = createUpdateSchema(stories).required({ publicId: true });
export type StoryValues = z.infer<typeof storyCreateSchema>;

const ratingRegex = /^\d*\.?\d*$/;

export const storyCreateWithProgressSchema = z.object({
    title: z.string().min(1, "Title is required"),
    author: z.string().min(1, "Author is required"),
    url: z.url("Must be a valid URL"),
    source: z.enum(sourceEnum.enumValues),
    description: z.string().optional(),
    chapter_count: z.number().min(0),
    word_count: z.number().min(0),
    is_nsfw: z.boolean(),
    status: z.enum(storyStatusEnum.enumValues),

    progressStatus: z.enum(progressStatusEnum.enumValues),
    current_chapter: z.number().min(0),
    rating: z
        .string()
        .refine(
            (val) =>
                val === "" ||
                (!Number.isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 5 && ratingRegex.test(val)),
            {
                message: "Rating must be a number between 0 and 5",
            },
        ),
    notes: z.string().optional(),

    tagIds: z.array(z.string()),
    fandomIds: z.array(z.string()),

    storyPublicId: z.string(),
    progressPublicId: z.string(),
});
export type StoryCreateWithProgressValues = z.infer<typeof storyCreateWithProgressSchema>;

export const storyCreateWithRelationsSchema = storyCreateSchema.extend({
    tagIds: z.array(z.string()).default([]),
    fandomIds: z.array(z.string()).default([]),
});
export type StoryCreateWithRelationsValues = z.infer<typeof storyCreateWithRelationsSchema>;

export const storyTags = createTable(
    "story_tag",
    (_d) => ({
        storyId: uuid()
            .notNull()
            .references(() => stories.id, { onDelete: "cascade" }),
        tagId: uuid()
            .notNull()
            .references(() => tags.id, { onDelete: "cascade" }),
    }),
    (t) => [
        primaryKey({ columns: [t.storyId, t.tagId] }),
        index("storytag_story_idx").on(t.storyId).concurrently(),
        index("storytag_tag_idx").on(t.tagId).concurrently(),
    ],
);

export const storyTagsRelations = relations(storyTags, ({ one }) => ({
    story: one(stories, {
        fields: [storyTags.storyId],
        references: [stories.id],
    }),
    tag: one(tags, {
        fields: [storyTags.tagId],
        references: [tags.id],
    }),
}));

export const storyFandoms = createTable(
    "story_fandom",
    (_d) => ({
        storyId: uuid()
            .notNull()
            .references(() => stories.id, { onDelete: "cascade" }),
        fandomId: uuid()
            .notNull()
            .references(() => fandoms.id, { onDelete: "cascade" }),
    }),
    (t) => [
        primaryKey({ columns: [t.storyId, t.fandomId] }),
        index("storyfandom_story_idx").on(t.storyId).concurrently(),
        index("storyfandom_fandom_idx").on(t.fandomId).concurrently(),
    ],
);

export const storyRelations = relations(stories, ({ many }) => ({
    tags: many(storyTags, {
        relationName: "story_tag_relation",
    }),
    fandoms: many(storyFandoms, {
        relationName: "story_fandom_relation",
    }),
}));
