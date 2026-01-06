DROP MATERIALIZED VIEW "public"."library_mv";--> statement-breakpoint
ALTER TABLE "topaz_progress" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "topaz_story" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."library_mv" AS (select "topaz_progress"."public_id" as "progress_public_id", "topaz_user"."public_id" as "user_public_id", "topaz_story"."public_id" as "story_public_id", "topaz_story"."title" as "story_title", "topaz_story"."author" as "story_author", "topaz_story"."source" as "story_source", "topaz_story"."url" as "story_url", "topaz_story"."status" as "story_status", "topaz_story"."chapter_count" as "story_chapter_count", "topaz_story"."word_count" as "story_word_count", "topaz_story"."is_nsfw" as "story_is_nsfw", "topaz_story"."description" as "story_description", "topaz_story"."version" as "story_version", "topaz_progress"."reading_status" as "progress_status", "topaz_progress"."current_chapter" as "progress_current_chapter", "topaz_progress"."rating" as "progress_rating", "topaz_progress"."notes" as "progress_notes", "topaz_progress"."version" as "progress_version", (
                setweight(to_tsvector('english', "topaz_story"."title"), 'A') ||
                setweight(to_tsvector('english', "topaz_story"."author"), 'B') ||
                setweight(to_tsvector('english', coalesce("topaz_story"."description", '')), 'C') ||
                setweight(to_tsvector('english', coalesce("topaz_story"."summary", '')), 'D') ||
                setweight(to_tsvector('english', coalesce(string_agg(DISTINCT "topaz_tag"."name", ' '), '')), 'C') ||
                setweight(to_tsvector('english', coalesce(string_agg(DISTINCT "topaz_fandom"."name", ' '), '')), 'C') ||
                setweight(to_tsvector('english', coalesce("topaz_progress"."reading_status"::text, 'Reading')), 'D') ||
                setweight(to_tsvector('english', coalesce("topaz_progress"."notes", '')), 'D')
            ) as "search_vector", COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'publicId', "topaz_tag"."public_id",
                        'name', "topaz_tag"."name"
                    )
                ) FILTER (WHERE "topaz_tag"."id" IS NOT NULL),
                '[]'::json
            ) as "tags", COALESCE(
                json_agg(
                    DISTINCT jsonb_build_object(
                        'publicId', "topaz_fandom"."public_id",
                        'name', "topaz_fandom"."name"
                    )
                ) FILTER (WHERE "topaz_fandom"."id" IS NOT NULL),
                '[]'::json
            ) as "fandoms", "topaz_progress"."updated_at" as "updated_at", "topaz_progress"."created_at" as "created_at" from "topaz_progress" inner join "topaz_user" on "topaz_user"."id" = "topaz_progress"."user_id" inner join "topaz_story" on "topaz_story"."id" = "topaz_progress"."story_id" left join "topaz_story_tag" on "topaz_story_tag"."story_id" = "topaz_story"."id" left join "topaz_tag" on "topaz_tag"."id" = "topaz_story_tag"."tag_id" left join "topaz_story_fandom" on "topaz_story_fandom"."story_id" = "topaz_story"."id" left join "topaz_fandom" on "topaz_fandom"."id" = "topaz_story_fandom"."fandom_id" group by "topaz_progress"."public_id", "topaz_user"."public_id", "topaz_story"."public_id", "topaz_story"."title", "topaz_story"."author", "topaz_story"."source", "topaz_story"."description", "topaz_story"."summary", "topaz_story"."url", "topaz_story"."status", "topaz_story"."chapter_count", "topaz_story"."word_count", "topaz_story"."is_nsfw", "topaz_progress"."reading_status", "topaz_progress"."current_chapter", "topaz_progress"."rating", "topaz_progress"."notes", "topaz_progress"."updated_at", "topaz_progress"."created_at");