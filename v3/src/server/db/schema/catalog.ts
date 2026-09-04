import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { citext, idColumns, timestampColumns } from "./_shared";

export const contentRatingEnum = pgEnum("content_rating", [
  "general",
  "teen",
  "mature",
  "explicit",
  "not_rated",
]);

export const publicationStatusEnum = pgEnum("publication_status", [
  "in_progress",
  "completed",
  "hiatus",
  "abandoned",
]);

export const contributorRoleEnum = pgEnum("contributor_role", [
  "author",
  "co_author",
  "translator",
  "editor",
]);

export const sourcePlatform = pgTable("source_platform", {
  ...idColumns(),
  baseUrl: text("base_url"),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  ...timestampColumns(),
});

export const work = pgTable(
  "work",
  {
    ...idColumns(),
    contentRating: contentRatingEnum("content_rating")
      .default("not_rated")
      .notNull(),
    description: text("description"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    publicationStatus: publicationStatusEnum("publication_status")
      .default("in_progress")
      .notNull(),
    sortTitle: text("sort_title").notNull(),
    summary: text("summary"),
    title: citext("title").notNull(),
    version: integer("version").default(1).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    index("work_title_trgm_idx").using("gin", sql`${table.title} gin_trgm_ops`),
    index("work_description_trgm_idx").using(
      "gin",
      sql`${table.description} gin_trgm_ops`
    ),
    index("work_summary_trgm_idx").using(
      "gin",
      sql`${table.summary} gin_trgm_ops`
    ),
  ]
);

export const workSource = pgTable(
  "work_source",
  {
    ...idColumns(),
    chapterCount: integer("chapter_count"),
    externalId: text("external_id"),
    normalizedUrl: text("normalized_url").notNull(),
    rawMetadata: jsonb("raw_metadata"),
    sourcePlatformId: uuid("source_platform_id")
      .notNull()
      .references(() => sourcePlatform.id),
    url: text("url").notNull(),
    wordCount: integer("word_count"),
    workId: uuid("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex("work_source_normalized_url_platform_uidx").on(
      table.sourcePlatformId,
      table.normalizedUrl
    ),
    uniqueIndex("work_source_external_id_platform_uidx")
      .on(table.sourcePlatformId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    index("work_source_work_id_idx").on(table.workId),
    index("work_source_url_trgm_idx").using(
      "gin",
      sql`${table.url} gin_trgm_ops`
    ),
    check(
      "work_source_raw_metadata_is_object",
      sql`${table.rawMetadata} is null or jsonb_typeof(${table.rawMetadata}) = 'object'`
    ),
    check("work_source_word_count_non_negative", sql`${table.wordCount} >= 0`),
    check(
      "work_source_chapter_count_non_negative",
      sql`${table.chapterCount} >= 0`
    ),
  ]
);

export const contributor = pgTable(
  "contributor",
  {
    ...idColumns(),
    name: citext("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    platformHandles: jsonb("platform_handles"),
    ...timestampColumns(),
  },
  (table) => [
    index("contributor_normalized_name_idx").on(table.normalizedName),
    index("contributor_name_trgm_idx").using(
      "gin",
      sql`${table.name} gin_trgm_ops`
    ),
    check(
      "contributor_platform_handles_is_object",
      sql`${table.platformHandles} is null or jsonb_typeof(${table.platformHandles}) = 'object'`
    ),
  ]
);

export const workContributor = pgTable(
  "work_contributor",
  {
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributor.id, { onDelete: "cascade" }),
    role: contributorRoleEnum("role").notNull(),
    workId: uuid("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.workId, table.contributorId, table.role],
    }),
    index("work_contributor_contributor_id_idx").on(table.contributorId),
  ]
);
