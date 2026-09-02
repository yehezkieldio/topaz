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
    { baseUrl: "https://archiveofourown.org", key: "ao3", name: "Archive of Our Own" },
    { baseUrl: "https://www.fanfiction.net", key: "fanfiction_net", name: "FanFiction.Net" },
    { baseUrl: "https://www.wattpad.com", key: "wattpad", name: "Wattpad" },
    { baseUrl: "https://forums.spacebattles.com", key: "spacebattles", name: "SpaceBattles" },
    { baseUrl: "https://forums.sufficientvelocity.com", key: "sufficient_velocity", name: "Sufficient Velocity" },
    { baseUrl: "https://forum.questionablequesting.com", key: "questionable_questing", name: "Questionable Questing" },
    { baseUrl: "https://www.royalroad.com", key: "royal_road", name: "Royal Road" },
    { baseUrl: "https://www.webnovel.com", key: "webnovel", name: "WebNovel" },
    { baseUrl: "https://www.scribblehub.com", key: "scribble_hub", name: "Scribble Hub" },
    { baseUrl: "https://novelbin.me", key: "novel_bin", name: "NovelBin" },
    { baseUrl: null, key: "other", name: "Other" },
] satisfies ReadonlyArray<{ baseUrl: string | null; key: SourcePlatformKey; name: string }>;

export const sourceLabels = {
    ArchiveOfOurOwn: "Archive of Our Own",
    FanFictionNet: "FanFiction.Net",
    NovelBin: "NovelBin",
    Other: "Other",
    QuestionableQuesting: "Questionable Questing",
    RoyalRoad: "Royal Road",
    ScribbleHub: "ScribbleHub",
    SpaceBattles: "SpaceBattles",
    SufficientVelocity: "Sufficient Velocity",
    Wattpad: "Wattpad",
    WebNovel: "WebNovel",
} as const;
export const sourceShortLabels = {
    ArchiveOfOurOwn: "AO3",
    FanFictionNet: "FFN",
    NovelBin: "NB",
    Other: "Other",
    QuestionableQuesting: "QQ",
    RoyalRoad: "RR",
    ScribbleHub: "SH",
    SpaceBattles: "SB",
    SufficientVelocity: "SV",
    Wattpad: "Wattpad",
    WebNovel: "WN",
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

export const workStatusEnum = z.enum(["Ongoing", "Completed", "Hiatus", "Abandoned", "Unknown"]);
export type WorkStatus = z.infer<typeof workStatusEnum>;
export const workStatusLabels = {
    Abandoned: "Abandoned",
    Completed: "Completed",
    Hiatus: "Hiatus",
    Ongoing: "Ongoing",
    Unknown: "Unknown",
} satisfies Record<WorkStatus, string>;

export const works = createTable(
    "work",
    (d) => ({
        ...ids,
        content_rating: d.text().notNull().default("unknown"),
        description: d.text(),
        is_nsfw: d.boolean().notNull().default(false),
        publication_status: d.text().notNull().default("Unknown"),
        sort_title: d.text().notNull(),
        summary: d.text(),
        title: citext().notNull(),
        version: d.integer().notNull().default(0),
        ...timestamps,
    }),
    (t) => [
        uniqueIndex("work_public_id_uidx").on(t.publicId).concurrently(),
        index("work_sort_title_idx").on(t.sort_title).concurrently(),
        index("work_publication_status_idx").on(t.publication_status).concurrently(),
        index("work_created_at_idx").on(t.created_at).concurrently(),
        index("work_updated_at_idx").on(t.updated_at).concurrently(),
        index("work_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")).concurrently(),
        index("work_description_trgm_idx").using("gin", t.description.op("gin_trgm_ops")).concurrently(),
        index("work_summary_trgm_idx").using("gin", t.summary.op("gin_trgm_ops")).concurrently(),
    ]
);

export const sourcePlatforms = createTable(
    "source_platform",
    (d) => ({
        ...ids,
        base_url: d.text(),
        is_active: d.boolean().notNull().default(true),
        key: d.text().notNull(),
        name: d.text().notNull(),
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
        author_on_source: d.text(),
        chapter_count: d.integer(),
        external_id: d.text(),
        first_published_at: d.timestamp({ mode: "date", withTimezone: true }),
        is_primary: d.boolean().notNull().default(false),
        last_checked_at: d.timestamp({ mode: "date", withTimezone: true }),
        last_updated_at: d.timestamp({ mode: "date", withTimezone: true }),
        normalized_url: d.text().notNull(),
        raw_metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
        source_status: d.text().notNull().default("Unknown"),
        sourcePlatformId: uuid()
            .notNull()
            .references(() => sourcePlatforms.id, { onDelete: "restrict" }),
        title_on_source: d.text(),
        url: d.text().notNull(),
        word_count: d.integer(),
        workId: uuid()
            .notNull()
            .references(() => works.id, { onDelete: "cascade" }),
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
        index("work_source_title_on_source_trgm_idx").using("gin", t.title_on_source.op("gin_trgm_ops")).concurrently(),
        index("work_source_author_on_source_trgm_idx")
            .using("gin", t.author_on_source.op("gin_trgm_ops"))
            .concurrently(),
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
        notes: d.text(),
        platform_handles: jsonb().$type<Record<string, string>>().notNull().default({}),
        sort_name: d.text().notNull(),
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
        contributorId: uuid()
            .notNull()
            .references(() => contributors.id, { onDelete: "cascade" }),
        created_at: d.timestamp({ mode: "date", withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
        display_order: d.integer().notNull().default(0),
        role: d.text().notNull().default("author"),
        workId: uuid()
            .notNull()
            .references(() => works.id, { onDelete: "cascade" }),
    }),
    (t) => [
        primaryKey({ columns: [t.workId, t.contributorId, t.role] }),
        index("work_contributor_contributor_idx").on(t.contributorId).concurrently(),
        index("work_contributor_work_idx").on(t.workId).concurrently(),
    ]
);

export const worksRelations = relations(works, ({ many }) => ({
    contributors: many(workContributors),
    sources: many(workSources),
}));

export const sourcePlatformsRelations = relations(sourcePlatforms, ({ many }) => ({
    sources: many(workSources),
}));

export const workSourcesRelations = relations(workSources, ({ one }) => ({
    sourcePlatform: one(sourcePlatforms, {
        fields: [workSources.sourcePlatformId],
        references: [sourcePlatforms.id],
    }),
    work: one(works, { fields: [workSources.workId], references: [works.id] }),
}));

export const contributorsRelations = relations(contributors, ({ many }) => ({
    works: many(workContributors),
}));

export const workContributorsRelations = relations(workContributors, ({ one }) => ({
    contributor: one(contributors, {
        fields: [workContributors.contributorId],
        references: [contributors.id],
    }),
    work: one(works, { fields: [workContributors.workId], references: [works.id] }),
}));

export const workCreateSchema = createInsertSchema(works);
export const workUpdateSchema = createUpdateSchema(works).required({ publicId: true });
export const workSourceCreateSchema = createInsertSchema(workSources);
export const contributorCreateSchema = createInsertSchema(contributors);

const ratingRegex = /^\d*\.?\d*$/;
const MIN_RATING = 0;
const MAX_RATING = 5;

export const workWithLibraryEntrySchema = z.object({
    author: z.string().min(1, "Author is required"),
    chapter_count: z.number().min(0),
    current_chapter: z.number().min(0),
    description: z.string().optional(),
    is_nsfw: z.boolean(),
    libraryEntryPublicId: z.string(),
    libraryEntryStatus: z.enum([
        "NotStarted",
        "Reading",
        "Paused",
        "Completed",
        "Dropped",
        "PlanToRead",
        "DroppedAsAbandoned",
    ]),
    libraryEntryVersion: z.number(),
    notes: z.string().optional(),
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
    source: sourceEnum,
    status: workStatusEnum,
    taxonomyTermIds: z.array(z.string()),
    title: z.string().min(1, "Title is required"),
    url: z.url("Must be a valid URL"),
    word_count: z.number().min(0),
    workPublicId: z.string(),
    workVersion: z.number(),
});
export type WorkWithLibraryEntryValues = z.infer<typeof workWithLibraryEntrySchema>;
