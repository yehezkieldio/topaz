import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { enumCheck, idColumns, jsonText, nocaseText, timestampColumns } from "./_shared";

// SQLite has no native enum type (03_data/00_schema_contract.md's pgEnum ->
// SQLite translation) -- these are plain literal-value arrays, giving the
// same TypeScript union via text(col, { enum: values }), with database-level
// enforcement restored by enumCheck() on each table below.
export const contentRatingValues = [
  "general",
  "teen",
  "mature",
  "explicit",
  "not_rated",
] as const;
export type ContentRating = (typeof contentRatingValues)[number];

export const publicationStatusValues = [
  "in_progress",
  "completed",
  "hiatus",
  "abandoned",
] as const;
export type PublicationStatus = (typeof publicationStatusValues)[number];

export const contributorRoleValues = [
  "author",
  "co_author",
  "translator",
  "editor",
] as const;
export type ContributorRole = (typeof contributorRoleValues)[number];

export const sourcePlatform = sqliteTable("source_platform", {
  ...idColumns(),
  baseUrl: text("base_url"),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  ...timestampColumns(),
});

// Free-text/fuzzy search over title/description/summary moves to an FTS5
// external-content virtual table (work_fts, 07_backend/03_search_and_filtering.md),
// not a column-level index here -- pg_trgm's GIN indexes have no per-column
// SQLite equivalent, and FTS5 virtual tables aren't expressed through
// sqliteTable(). See src/server/db/schema/search.ts once that lands.
export const work = sqliteTable(
  "work",
  {
    ...idColumns(),
    contentRating: text("content_rating", { enum: contentRatingValues })
      .default("not_rated")
      .notNull(),
    description: text("description"),
    isNsfw: integer("is_nsfw", { mode: "boolean" }).default(false).notNull(),
    publicationStatus: text("publication_status", {
      enum: publicationStatusValues,
    })
      .default("in_progress")
      .notNull(),
    sortTitle: text("sort_title").notNull(),
    summary: text("summary"),
    title: nocaseText("title").notNull(),
    version: integer("version").default(1).notNull(),
    ...timestampColumns(),
  },
  (table) => [
    enumCheck("work_content_rating_valid", table.contentRating, contentRatingValues),
    enumCheck(
      "work_publication_status_valid",
      table.publicationStatus,
      publicationStatusValues
    ),
  ]
);

export const workSource = sqliteTable(
  "work_source",
  {
    ...idColumns(),
    chapterCount: integer("chapter_count"),
    externalId: text("external_id"),
    normalizedUrl: text("normalized_url").notNull(),
    rawMetadata: jsonText<Record<string, unknown>>("raw_metadata"),
    sourcePlatformId: text("source_platform_id")
      .notNull()
      .references(() => sourcePlatform.id),
    url: text("url").notNull(),
    wordCount: integer("word_count"),
    workId: text("work_id")
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
    check(
      "work_source_raw_metadata_is_object",
      sql`${table.rawMetadata} is null or (json_valid(${table.rawMetadata}) and json_type(${table.rawMetadata}) = 'object')`
    ),
    check("work_source_word_count_non_negative", sql`${table.wordCount} >= 0`),
    check(
      "work_source_chapter_count_non_negative",
      sql`${table.chapterCount} >= 0`
    ),
  ]
);

export const contributor = sqliteTable(
  "contributor",
  {
    ...idColumns(),
    name: nocaseText("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    platformHandles: jsonText<Record<string, unknown>>("platform_handles"),
    ...timestampColumns(),
  },
  (table) => [
    index("contributor_normalized_name_idx").on(table.normalizedName),
    check(
      "contributor_platform_handles_is_object",
      sql`${table.platformHandles} is null or (json_valid(${table.platformHandles}) and json_type(${table.platformHandles}) = 'object')`
    ),
  ]
);

export const workContributor = sqliteTable(
  "work_contributor",
  {
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributor.id, { onDelete: "cascade" }),
    role: text("role", { enum: contributorRoleValues }).notNull(),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    ...timestampColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.workId, table.contributorId, table.role],
    }),
    index("work_contributor_contributor_id_idx").on(table.contributorId),
    enumCheck("work_contributor_role_valid", table.role, contributorRoleValues),
  ]
);
