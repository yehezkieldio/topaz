CREATE TYPE "public"."taxonomy_kind" AS ENUM('Fandom', 'Tag', 'Genre', 'Character', 'Relationship', 'Warning', 'SourceCategory', 'Custom');--> statement-breakpoint
CREATE TABLE "topaz_story_taxonomy_term" (
	"story_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	CONSTRAINT "topaz_story_taxonomy_term_story_id_term_id_pk" PRIMARY KEY("story_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "topaz_taxonomy_alias" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"term_id" uuid NOT NULL,
	"name" "citext" NOT NULL,
	"slug" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_taxonomy_term" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"kind" "taxonomy_kind" DEFAULT 'Tag' NOT NULL,
	"name" "citext" NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
DROP MATERIALIZED VIEW "public"."library_mv";--> statement-breakpoint
DROP MATERIALIZED VIEW "public"."library_stats_mv";--> statement-breakpoint
DROP TABLE "topaz_fandom" CASCADE;--> statement-breakpoint
DROP TABLE "topaz_story_fandom" CASCADE;--> statement-breakpoint
DROP TABLE "topaz_story_tag" CASCADE;--> statement-breakpoint
DROP TABLE "topaz_tag" CASCADE;--> statement-breakpoint
ALTER TABLE "topaz_story_taxonomy_term" ADD CONSTRAINT "topaz_story_taxonomy_term_story_id_topaz_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."topaz_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_story_taxonomy_term" ADD CONSTRAINT "topaz_story_taxonomy_term_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_taxonomy_alias" ADD CONSTRAINT "topaz_taxonomy_alias_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "storytaxonomyterm_story_idx" ON "topaz_story_taxonomy_term" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "storytaxonomyterm_term_idx" ON "topaz_story_taxonomy_term" USING btree ("term_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomyalias_pid_uidx" ON "topaz_taxonomy_alias" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomyalias_term_slug_uidx" ON "topaz_taxonomy_alias" USING btree ("term_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomyalias_term_name_uidx" ON "topaz_taxonomy_alias" USING btree ("term_id","name");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyalias_term_idx" ON "topaz_taxonomy_alias" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyalias_name_trgm_idx" ON "topaz_taxonomy_alias" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomyterm_pid_uidx" ON "topaz_taxonomy_term" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomyterm_kind_slug_uidx" ON "topaz_taxonomy_term" USING btree ("kind","slug");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomyterm_kind_name_uidx" ON "topaz_taxonomy_term" USING btree ("kind","name");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyterm_kind_idx" ON "topaz_taxonomy_term" USING btree ("kind");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyterm_created_idx" ON "topaz_taxonomy_term" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyterm_updated_idx" ON "topaz_taxonomy_term" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyterm_name_trgm_idx" ON "topaz_taxonomy_term" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyterm_slug_trgm_idx" ON "topaz_taxonomy_term" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."library_mv" AS (select "topaz_progress"."public_id" as "progress_public_id", "topaz_user"."public_id" as "user_public_id", "topaz_story"."public_id" as "story_public_id", "topaz_story"."title" as "story_title", "topaz_story"."author" as "story_author", "topaz_story"."source" as "story_source", "topaz_story"."url" as "story_url", "topaz_story"."status" as "story_status", "topaz_story"."chapter_count" as "story_chapter_count", "topaz_story"."word_count" as "story_word_count", "topaz_story"."is_nsfw" as "story_is_nsfw", "topaz_story"."description" as "story_description", "topaz_story"."version" as "story_version", "topaz_progress"."reading_status" as "progress_status", "topaz_progress"."current_chapter" as "progress_current_chapter", "topaz_progress"."rating" as "progress_rating", "topaz_progress"."notes" as "progress_notes", "topaz_progress"."version" as "progress_version", (
                setweight(to_tsvector('english', "topaz_story"."title"), 'A') ||
                setweight(to_tsvector('english', "topaz_story"."author"), 'B') ||
                setweight(to_tsvector('english', coalesce("topaz_story"."description", '')), 'C') ||
                setweight(to_tsvector('english', coalesce("topaz_story"."summary", '')), 'D') ||
                setweight(to_tsvector('english', coalesce(string_agg(DISTINCT "topaz_taxonomy_term"."name", ' '), '')), 'C') ||
                setweight(to_tsvector('english', coalesce("topaz_progress"."reading_status"::text, 'Reading')), 'D') ||
                setweight(to_tsvector('english', coalesce("topaz_progress"."notes", '')), 'D')
            ) as "search_vector", COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'publicId', "topaz_taxonomy_term"."public_id",
                        'name', "topaz_taxonomy_term"."name",
                        'kind', "topaz_taxonomy_term"."kind"
                    )
                ) FILTER (WHERE "topaz_taxonomy_term"."id" IS NOT NULL),
                '[]'::json
            ) as "taxonomy_terms", "topaz_progress"."updated_at" as "updated_at", "topaz_progress"."created_at" as "created_at" from "topaz_progress" inner join "topaz_user" on "topaz_user"."id" = "topaz_progress"."user_id" inner join "topaz_story" on "topaz_story"."id" = "topaz_progress"."story_id" left join "topaz_story_taxonomy_term" on "topaz_story_taxonomy_term"."story_id" = "topaz_story"."id" left join "topaz_taxonomy_term" on "topaz_taxonomy_term"."id" = "topaz_story_taxonomy_term"."term_id" group by "topaz_progress"."public_id", "topaz_user"."public_id", "topaz_story"."public_id", "topaz_story"."title", "topaz_story"."author", "topaz_story"."source", "topaz_story"."description", "topaz_story"."summary", "topaz_story"."url", "topaz_story"."status", "topaz_story"."chapter_count", "topaz_story"."word_count", "topaz_story"."is_nsfw", "topaz_story"."version", "topaz_progress"."reading_status", "topaz_progress"."current_chapter", "topaz_progress"."rating", "topaz_progress"."notes", "topaz_progress"."version", "topaz_progress"."updated_at", "topaz_progress"."created_at");--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."library_stats_mv" AS (select COALESCE(SUM("topaz_story"."word_count"), 0) as "total_words_read", COALESCE(SUM("topaz_story"."chapter_count"), 0) as "total_chapters_read", (
                SELECT COUNT(DISTINCT "topaz_story_taxonomy_term"."term_id")
                FROM "topaz_story_taxonomy_term"
            ) as "taxonomy_term_count", COUNT(DISTINCT "topaz_story"."id") as "story_count", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Completed' THEN 1 END) as "completed", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Paused' THEN 1 END) as "paused", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Dropped' THEN 1 END) as "dropped", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Reading' THEN 1 END) as "reading", COALESCE(AVG("topaz_progress"."rating"), 0) as "average_rating" from "topaz_progress" inner join "topaz_story" on "topaz_story"."id" = "topaz_progress"."story_id");
--> statement-breakpoint
CREATE INDEX "idx_library_mv_search" ON "library_mv" USING GIN ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_progress_pid" ON "library_mv"("progress_public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_user_progress_pid" ON "library_mv"("user_public_id", "progress_public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_user_story_unique" ON "library_mv"("user_public_id", "story_public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_library_mv_progress_public_id" ON "library_mv"("progress_public_id");
