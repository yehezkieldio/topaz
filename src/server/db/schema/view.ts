import { type SQL, sql } from "drizzle-orm";
import { pgMaterializedView } from "drizzle-orm/pg-core";
import { type ProgressSortBy, progresses } from "#/server/db/schema/progress";
import { stories, storyTaxonomyTerms } from "#/server/db/schema/story";
import { type TaxonomyKind, taxonomyTerms } from "#/server/db/schema/taxonomy";
import { users } from "#/server/db/schema/user";

export type StoryTaxonomyTerm = {
    kind: TaxonomyKind;
    name: string;
    publicId: string;
};

export const libraryMaterializedView = pgMaterializedView("library_mv").as((qb) =>
    qb
        .select({
            progressPublicId: sql<string>`${progresses.publicId}`.as("progress_public_id"),
            userPublicId: sql<string>`${users.publicId}`.as("user_public_id"),
            storyPublicId: sql<string>`${stories.publicId}`.as("story_public_id"),
            storyTitle: sql<string>`${stories.title}`.as("story_title"),
            storyAuthor: sql<string>`${stories.author}`.as("story_author"),
            storySource: sql<string>`${stories.source}`.as("story_source"),
            storyUrl: sql<string>`${stories.url}`.as("story_url"),
            storyStatus: sql<string>`${stories.status}`.as("story_status"),
            storyChapterCount: sql<number>`${stories.chapter_count}`.as("story_chapter_count"),
            storyWordCount: sql<number>`${stories.word_count}`.as("story_word_count"),
            storyIsNsfw: sql<boolean>`${stories.is_nsfw}`.as("story_is_nsfw"),
            storyDescription: sql<string>`${stories.description}`.as("story_description"),
            storyVersion: sql<number>`${stories.version}`.as("story_version"),
            progressStatus: sql<string>`${progresses.status}`.as("progress_status"),
            progressCurrentChapter: sql<number>`${progresses.current_chapter}`.as("progress_current_chapter"),
            progressRating: sql<number>`${progresses.rating}`.as("progress_rating"),
            progressNotes: sql<string>`${progresses.notes}`.as("progress_notes"),
            progressVersion: sql<number>`${progresses.version}`.as("progress_version"),
            searchVector: sql<string>`(
                setweight(to_tsvector('english', ${stories.title}), 'A') ||
                setweight(to_tsvector('english', ${stories.author}), 'B') ||
                setweight(to_tsvector('english', coalesce(${stories.description}, '')), 'C') ||
                setweight(to_tsvector('english', coalesce(${stories.summary}, '')), 'D') ||
                setweight(to_tsvector('english', coalesce(string_agg(DISTINCT ${taxonomyTerms.name}, ' '), '')), 'C') ||
                setweight(to_tsvector('english', coalesce(${progresses.status}::text, 'Reading')), 'D') ||
                setweight(to_tsvector('english', coalesce(${progresses.notes}, '')), 'D')
            )`.as("search_vector"),
            taxonomyTerms: sql<StoryTaxonomyTerm[]>`COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'publicId', ${taxonomyTerms.publicId},
                        'name', ${taxonomyTerms.name},
                        'kind', ${taxonomyTerms.kind}
                    )
                ) FILTER (WHERE ${taxonomyTerms.id} IS NOT NULL),
                '[]'::json
            )`.as("taxonomy_terms"),
            updatedAt: sql<Date>`${progresses.updated_at}`.as("updated_at"),
            createdAt: sql<Date>`${progresses.created_at}`.as("created_at"),
        })
        .from(progresses)
        .innerJoin(users, sql`${users.id} = ${progresses.userId}`)
        .innerJoin(stories, sql`${stories.id} = ${progresses.storyId}`)
        .leftJoin(storyTaxonomyTerms, sql`${storyTaxonomyTerms.storyId} = ${stories.id}`)
        .leftJoin(taxonomyTerms, sql`${taxonomyTerms.id} = ${storyTaxonomyTerms.termId}`)
        .groupBy(
            progresses.publicId,
            users.publicId,
            stories.publicId,
            stories.title,
            stories.author,
            stories.source,
            stories.description,
            stories.summary,
            stories.url,
            stories.status,
            stories.chapter_count,
            stories.word_count,
            stories.is_nsfw,
            stories.version,
            progresses.status,
            progresses.current_chapter,
            progresses.rating,
            progresses.notes,
            progresses.version,
            progresses.updated_at,
            progresses.created_at
        )
);

export const libraryStatsMaterializedView = pgMaterializedView("library_stats_mv").as((qb) =>
    qb
        .select({
            totalWordsRead: sql<number>`COALESCE(SUM(${stories.word_count}), 0)`.as("total_words_read"),
            totalChaptersRead: sql<number>`COALESCE(SUM(${stories.chapter_count}), 0)`.as("total_chapters_read"),
            taxonomyTermCount: sql<number>`(
                SELECT COUNT(DISTINCT ${storyTaxonomyTerms.termId})
                FROM ${storyTaxonomyTerms}
            )`.as("taxonomy_term_count"),
            storyCount: sql<number>`COUNT(DISTINCT ${stories.id})`.as("story_count"),
            completedCount: sql<number>`COUNT(CASE WHEN ${progresses.status} = 'Completed' THEN 1 END)`.as("completed"),
            pausedCount: sql<number>`COUNT(CASE WHEN ${progresses.status} = 'Paused' THEN 1 END)`.as("paused"),
            droppedCount: sql<number>`COUNT(CASE WHEN ${progresses.status} = 'Dropped' THEN 1 END)`.as("dropped"),
            readingCount: sql<number>`COUNT(CASE WHEN ${progresses.status} = 'Reading' THEN 1 END)`.as("reading"),
            averageRating: sql<number>`COALESCE(AVG(${progresses.rating}), 0)`.as("average_rating"),
        })
        .from(progresses)
        .innerJoin(stories, sql`${stories.id} = ${progresses.storyId}`)
);

const sortColumnMap: Record<
    ProgressSortBy,
    SQL<unknown> | SQL.Aliased<string> | SQL.Aliased<number> | SQL.Aliased<Date> | SQL.Aliased<boolean>
> = {
    title: libraryMaterializedView.storyTitle,
    author: libraryMaterializedView.storyAuthor,
    status: libraryMaterializedView.progressStatus,
    rating: libraryMaterializedView.progressRating,
    progress: sql`CASE
        WHEN ${libraryMaterializedView.storyChapterCount} > 0
        THEN (${libraryMaterializedView.progressCurrentChapter}::float / ${libraryMaterializedView.storyChapterCount}::float)
        ELSE 0
    END`,
    updatedAt: libraryMaterializedView.updatedAt,
    createdAt: libraryMaterializedView.createdAt,
    wordCount: libraryMaterializedView.storyWordCount,
    chapterCount: libraryMaterializedView.storyChapterCount,
    isNsfw: libraryMaterializedView.storyIsNsfw,
};

export function getSortColumn(
    sortBy: ProgressSortBy
): SQL<unknown> | SQL.Aliased<string> | SQL.Aliased<number> | SQL.Aliased<Date> | SQL.Aliased<boolean> {
    return sortColumnMap[sortBy];
}
