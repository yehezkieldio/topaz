CREATE EXTENSION IF NOT EXISTS pg_trgm; --> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS citext; --> statement-breakpoint
CREATE TYPE "public"."reading_status" AS ENUM('NotStarted', 'Reading', 'Paused', 'Completed', 'Dropped');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('ArchiveOfOurOwn', 'FanFictionNet', 'Wattpad', 'SpaceBattles', 'SufficientVelocity', 'QuestionableQuesting', 'RoyalRoad', 'WebNovel', 'ScribbleHub', 'NovelBin', 'Other');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('Ongoing', 'Completed', 'Hiatus', 'Abandoned');--> statement-breakpoint
CREATE TABLE "topaz_fandom" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"name" "citext" NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_progress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"reading_status" "reading_status" DEFAULT 'Reading' NOT NULL,
	"current_chapter" integer DEFAULT 0 NOT NULL,
	"rating" numeric(2, 1) DEFAULT '0.0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone,
	CONSTRAINT "rating between 0 and 5" CHECK ("topaz_progress"."rating" >= 0 AND "topaz_progress"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "topaz_story" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"author" "citext" DEFAULT 'Unknown' NOT NULL,
	"chapter_count" integer,
	"description" "citext",
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"word_count" integer,
	"source" "source" DEFAULT 'Other' NOT NULL,
	"status" "story_status" DEFAULT 'Ongoing' NOT NULL,
	"summary" "citext",
	"title" "citext" NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_story_fandom" (
	"story_id" uuid NOT NULL,
	"fandom_id" uuid NOT NULL,
	CONSTRAINT "topaz_story_fandom_story_id_fandom_id_pk" PRIMARY KEY("story_id","fandom_id")
);
--> statement-breakpoint
CREATE TABLE "topaz_story_tag" (
	"story_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "topaz_story_tag_story_id_tag_id_pk" PRIMARY KEY("story_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "topaz_tag" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"name" "citext" NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_account" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "topaz_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "topaz_session" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topaz_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "topaz_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "topaz_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "topaz_progress" ADD CONSTRAINT "topaz_progress_user_id_topaz_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."topaz_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_progress" ADD CONSTRAINT "topaz_progress_story_id_topaz_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."topaz_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_story_fandom" ADD CONSTRAINT "topaz_story_fandom_story_id_topaz_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."topaz_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_story_fandom" ADD CONSTRAINT "topaz_story_fandom_fandom_id_topaz_fandom_id_fk" FOREIGN KEY ("fandom_id") REFERENCES "public"."topaz_fandom"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_story_tag" ADD CONSTRAINT "topaz_story_tag_story_id_topaz_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."topaz_story"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_story_tag" ADD CONSTRAINT "topaz_story_tag_tag_id_topaz_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."topaz_tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_account" ADD CONSTRAINT "topaz_account_user_id_topaz_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."topaz_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_session" ADD CONSTRAINT "topaz_session_user_id_topaz_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."topaz_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "topaz_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "t_user_id_idx" ON "topaz_session" USING btree ("user_id");--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."library_mv" AS (select "topaz_progress"."public_id" as "progress_public_id", "topaz_user"."public_id" as "user_public_id", "topaz_story"."public_id" as "story_public_id", "topaz_story"."title" as "story_title", "topaz_story"."author" as "story_author", "topaz_story"."source" as "story_source", "topaz_story"."url" as "story_url", "topaz_story"."status" as "story_status", "topaz_story"."chapter_count" as "story_chapter_count", "topaz_story"."word_count" as "story_word_count", "topaz_story"."is_nsfw" as "story_is_nsfw", "topaz_story"."description" as "story_description", "topaz_progress"."reading_status" as "progress_status", "topaz_progress"."current_chapter" as "progress_current_chapter", "topaz_progress"."rating" as "progress_rating", "topaz_progress"."notes" as "progress_notes", (
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
            ) as "fandoms", "topaz_progress"."updated_at" as "updated_at", "topaz_progress"."created_at" as "created_at" from "topaz_progress" inner join "topaz_user" on "topaz_user"."id" = "topaz_progress"."user_id" inner join "topaz_story" on "topaz_story"."id" = "topaz_progress"."story_id" left join "topaz_story_tag" on "topaz_story_tag"."story_id" = "topaz_story"."id" left join "topaz_tag" on "topaz_tag"."id" = "topaz_story_tag"."tag_id" left join "topaz_story_fandom" on "topaz_story_fandom"."story_id" = "topaz_story"."id" left join "topaz_fandom" on "topaz_fandom"."id" = "topaz_story_fandom"."fandom_id" group by "topaz_progress"."public_id", "topaz_user"."public_id", "topaz_story"."public_id", "topaz_story"."title", "topaz_story"."author", "topaz_story"."source", "topaz_story"."description", "topaz_story"."summary", "topaz_story"."url", "topaz_story"."status", "topaz_story"."chapter_count", "topaz_story"."word_count", "topaz_story"."is_nsfw", "topaz_progress"."reading_status", "topaz_progress"."current_chapter", "topaz_progress"."rating", "topaz_progress"."notes", "topaz_progress"."updated_at", "topaz_progress"."created_at");--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."library_stats_mv" AS (select COALESCE(SUM("topaz_story"."word_count"), 0) as "total_words_read", COALESCE(SUM("topaz_story"."chapter_count"), 0) as "total_chapters_read", COUNT(DISTINCT "topaz_fandom"."id") as "fandom_count", COUNT(DISTINCT "topaz_story"."id") as "story_count", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Completed' THEN 1 END) as "completed", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Paused' THEN 1 END) as "paused", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Dropped' THEN 1 END) as "dropped", COUNT(CASE WHEN "topaz_progress"."reading_status" = 'Reading' THEN 1 END) as "reading", COALESCE(AVG("topaz_progress"."rating"), 0) as "average_rating" from "topaz_progress" inner join "topaz_story" on "topaz_story"."id" = "topaz_progress"."story_id" left join "topaz_story_fandom" on "topaz_story_fandom"."story_id" = "topaz_story"."id" left join "topaz_fandom" on "topaz_fandom"."id" = "topaz_story_fandom"."fandom_id");

COMMIT;
--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "fandom_pid_uidx" ON "topaz_fandom" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "fandom_name_uidx" ON "topaz_fandom" USING btree ("name");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "fandom_created_idx" ON "topaz_fandom" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "fandom_updated_idx" ON "topaz_fandom" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "fandom_name_trgm_idx" ON "topaz_fandom" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "prog_pid_uidx" ON "topaz_progress" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "prog_user_story_uidx" ON "topaz_progress" USING btree ("user_id","story_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "prog_user_status_idx" ON "topaz_progress" USING btree ("user_id","reading_status");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "prog_user_idx" ON "topaz_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "prog_story_idx" ON "topaz_progress" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "prog_status_idx" ON "topaz_progress" USING btree ("reading_status");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "prog_updated_idx" ON "topaz_progress" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "prog_created_idx" ON "topaz_progress" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "story_pid_uidx" ON "topaz_story" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "story_source_status_idx" ON "topaz_story" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "story_created_idx" ON "topaz_story" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "story_updated_idx" ON "topaz_story" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "storyfandom_story_idx" ON "topaz_story_fandom" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "storyfandom_fandom_idx" ON "topaz_story_fandom" USING btree ("fandom_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "storytag_story_idx" ON "topaz_story_tag" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "storytag_tag_idx" ON "topaz_story_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "tag_pid_uidx" ON "topaz_tag" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "tag_name_uidx" ON "topaz_tag" USING btree ("name");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "tag_created_idx" ON "topaz_tag" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "tag_updated_idx" ON "topaz_tag" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_library_mv_search" ON "library_mv" USING GIN ("search_vector"); --> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_progress_pid" ON "library_mv"("progress_public_id"); --> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_user_progress_pid" ON "library_mv"("user_public_id", "progress_public_id"); --> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_user_library_mv_user_story_unique" ON "library_mv"("user_public_id", "story_public_id"); --> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "idx_library_mv_progress_public_id" ON "library_mv"("progress_public_id"); --> statement-breakpoint
