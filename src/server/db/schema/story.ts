import { relations, sql } from "drizzle-orm";
import { check, index, jsonb, primaryKey, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citext, createTable, ids, timestamps } from "#/server/db/utils";

export const sourcePlatformKeys = [
    "ao3",
    "fanfiction_net",
    "wattpad",
    "spacebattles",
    "sufficient_velocity",
    "questionable_questing",
    "royal_road",
    "webnovel",
    "scribble_hub",
    "novel_bin",
    "other",
] as const;
export type SourcePlatformKey = (typeof sourcePlatformKeys)[number];

export const sourcePlatformSeeds = [
    { key: "ao3", name: "Archive of Our Own", baseUrl: "https://archiveofourown.org" },
    { key: "fanfiction_net", name: "FanFiction.Net", baseUrl: "https://www.fanfiction.net" },
    { key: "wattpad", name: "Wattpad", baseUrl: "https://www.wattpad.com" },
    { key: "spacebattles", name: "SpaceBattles", baseUrl: "https://forums.spacebattles.com" },
    { key: "sufficient_velocity", name: "Sufficient Velocity", baseUrl: "https://forums.sufficientvelocity.com" },
    { key: "questionable_questing", name: "Questionable Questing", baseUrl: "https://forum.questionablequesting.com" },
    { key: "royal_road", name: "Royal Road", baseUrl: "https://www.royalroad.com" },
    { key: "webnovel", name: "WebNovel", baseUrl: "https://www.webnovel.com" },
    { key: "scribble_hub", name: "Scribble Hub", baseUrl: "https://www.scribblehub.com" },
    { key: "novel_bin", name: "NovelBin", baseUrl: "https://novelbin.me" },
    { key: "other", name: "Other", baseUrl: null },
] satisfies ReadonlyArray<{ baseUrl: string | null; key: SourcePlatformKey; name: string }>;

export const sourceLabels = {
    ArchiveOfOurOwn: "Archive of Our Own",
    FanFictionNet: "FanFiction.Net",
    Wattpad: "Wattpad",
    SpaceBattles: "SpaceBattles",
    SufficientVelocity: "Sufficient Velocity",
    QuestionableQuesting: "Questionable Questing",
    RoyalRoad: "Royal Road",
    WebNovel: "WebNovel",
    ScribbleHub: "ScribbleHub",
    NovelBin: "NovelBin",
    Other: "Other",
} as const;
export const sourceShortLabels = {
    ArchiveOfOurOwn: "AO3",
    FanFictionNet: "FFN",
    Wattpad: "Wattpad",
    SpaceBattles: "SB",
    SufficientVelocity: "SV",
    QuestionableQuesting: "QQ",
    RoyalRoad: "RR",
    WebNovel: "WN",
    ScribbleHub: "SH",
    NovelBin: "NB",
    Other: "Other",
} as const;
export const sourceEnum = z.enum([
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
export type Source = z.infer<typeof sourceEnum>;

export const storyStatusEnum = z.enum(["Ongoing", "Completed", "Hiatus", "Abandoned", "Unknown"]);
export type StoryStatus = z.infer<typeof storyStatusEnum>;
export const storyStatusLabels = {
    Ongoing: "Ongoing",
    Completed: "Completed",
    Hiatus: "Hiatus",
    Abandoned: "Abandoned",
    Unknown: "Unknown",
} satisfies Record<StoryStatus, string>;

export const works = createTable(
    "work",
    (d) => ({
        ...ids,
        title: citext().notNull(),
        sort_title: d.text().notNull(),
        description: d.text(),
        summary: d.text(),
        publication_status: d.text().notNull().default("unknown"),
        content_rating: d.text().notNull().default("unknown"),
        is_nsfw: d.boolean().notNull().default(false),
        version: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("work_public_id_uidx").on(t.publicId).concurrently(),
        index("work_sort_title_idx").on(t.sort_title).concurrently(),
        index("work_publication_status_idx").on(t.publication_status).concurrently(),
        index("work_created_at_idx").on(t.created_at).concurrently(),
        index("work_updated_at_idx").on(t.updated_at).concurrently(),
    ]
);

export const sourcePlatforms = createTable(
    "source_platform",
    (d) => ({
        ...ids,
        key: d.text().notNull(),
        name: d.text().notNull(),
        base_url: d.text(),
        is_active: d.boolean().notNull().default(true),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("source_platform_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("source_platform_key_uidx").on(t.key).concurrently(),
    ]
);

export const workSources = createTable(
    "work_source",
    (d) => ({
        ...ids,
        workId: uuid()
            .notNull()
            .references(() => works.id, { onDelete: "cascade" }),
        sourcePlatformId: uuid()
            .notNull()
            .references(() => sourcePlatforms.id, { onDelete: "restrict" }),
        url: d.text().notNull(),
        normalized_url: d.text().notNull(),
        external_id: d.text(),
        title_on_source: d.text(),
        author_on_source: d.text(),
        chapter_count: d.integer(),
        word_count: d.integer(),
        source_status: d.text().notNull().default("unknown"),
        first_published_at: d.timestamp({ mode: "date", withTimezone: true }),
        last_updated_at: d.timestamp({ mode: "date", withTimezone: true }),
        last_checked_at: d.timestamp({ mode: "date", withTimezone: true }),
        raw_metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
        is_primary: d.boolean().notNull().default(false),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("work_source_public_id_uidx").on(t.publicId).concurrently(),
        uniqueIndex("work_source_platform_normalized_url_uidx").on(t.sourcePlatformId, t.normalized_url).concurrently(),
        uniqueIndex("work_source_platform_external_id_uidx")
            .on(t.sourcePlatformId, t.external_id)
            .where(sql`${t.external_id} IS NOT NULL`)
            .concurrently(),
        index("work_source_work_idx").on(t.workId).concurrently(),
        index("work_source_platform_idx").on(t.sourcePlatformId).concurrently(),
        index("work_source_primary_idx").on(t.workId, t.is_primary).concurrently(),
        check("work_source_chapter_count_nonnegative", sql`${t.chapter_count} IS NULL OR ${t.chapter_count} >= 0`),
        check("work_source_word_count_nonnegative", sql`${t.word_count} IS NULL OR ${t.word_count} >= 0`),
        check("work_source_raw_metadata_object", sql`jsonb_typeof(${t.raw_metadata}) = 'object'`),
    ]
);

export const contributors = createTable(
    "contributor",
    (d) => ({
        ...ids,
        name: citext().notNull(),
        sort_name: d.text().notNull(),
        platform_handles: jsonb().$type<Record<string, string>>().notNull().default({}),
        notes: d.text(),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("contributor_public_id_uidx").on(t.publicId).concurrently(),
        index("contributor_sort_name_idx").on(t.sort_name).concurrently(),
        index("contributor_name_trgm_idx").using("gin", t.name.op("gin_trgm_ops")).concurrently(),
        check("contributor_platform_handles_object", sql`jsonb_typeof(${t.platform_handles}) = 'object'`),
    ]
);

export const workContributors = createTable(
    "work_contributor",
    (d) => ({
        workId: uuid()
            .notNull()
            .references(() => works.id, { onDelete: "cascade" }),
        contributorId: uuid()
            .notNull()
            .references(() => contributors.id, { onDelete: "cascade" }),
        role: d.text().notNull().default("author"),
        display_order: d.integer().notNull().default(0),
        created_at: d.timestamp({ mode: "date", withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    }),
    (t) => [
        primaryKey({ columns: [t.workId, t.contributorId, t.role] }),
        index("work_contributor_contributor_idx").on(t.contributorId).concurrently(),
        index("work_contributor_work_idx").on(t.workId).concurrently(),
    ]
);

export const worksRelations = relations(works, ({ many }) => ({
    sources: many(workSources),
    contributors: many(workContributors),
}));

export const sourcePlatformsRelations = relations(sourcePlatforms, ({ many }) => ({
    sources: many(workSources),
}));

export const workSourcesRelations = relations(workSources, ({ one }) => ({
    work: one(works, { fields: [workSources.workId], references: [works.id] }),
    sourcePlatform: one(sourcePlatforms, {
        fields: [workSources.sourcePlatformId],
        references: [sourcePlatforms.id],
    }),
}));

export const contributorsRelations = relations(contributors, ({ many }) => ({
    works: many(workContributors),
}));

export const workContributorsRelations = relations(workContributors, ({ one }) => ({
    work: one(works, { fields: [workContributors.workId], references: [works.id] }),
    contributor: one(contributors, {
        fields: [workContributors.contributorId],
        references: [contributors.id],
    }),
}));

export const workCreateSchema = createInsertSchema(works);
export const workUpdateSchema = createUpdateSchema(works).required({ publicId: true });
export const workSourceCreateSchema = createInsertSchema(workSources);
export const contributorCreateSchema = createInsertSchema(contributors);

const ratingRegex = /^\d*\.?\d*$/;
const MIN_RATING = 0;
const MAX_RATING = 5;

export const storyCreateWithProgressSchema = z.object({
    title: z.string().min(1, "Title is required"),
    author: z.string().min(1, "Author is required"),
    url: z.url("Must be a valid URL"),
    source: sourceEnum,
    description: z.string().optional(),
    chapter_count: z.number().min(0),
    word_count: z.number().min(0),
    is_nsfw: z.boolean(),
    status: storyStatusEnum,
    progressStatus: z.enum([
        "NotStarted",
        "Reading",
        "Paused",
        "Completed",
        "Dropped",
        "PlanToRead",
        "DroppedAsAbandoned",
    ]),
    current_chapter: z.number().min(0),
    rating: z
        .string()
        .refine(
            (val) =>
                val === "" ||
                (!Number.isNaN(Number(val)) &&
                    Number(val) >= MIN_RATING &&
                    Number(val) <= MAX_RATING &&
                    ratingRegex.test(val)),
            { message: "Rating must be a number between 0 and 5" }
        ),
    notes: z.string().optional(),
    taxonomyTermIds: z.array(z.string()),
    storyPublicId: z.string(),
    progressPublicId: z.string(),
    storyVersion: z.number(),
    progressVersion: z.number(),
});
export type StoryCreateWithProgressValues = z.infer<typeof storyCreateWithProgressSchema>;
