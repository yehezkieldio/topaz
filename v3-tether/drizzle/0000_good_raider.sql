CREATE TYPE "public"."content_rating" AS ENUM('general', 'teen', 'mature', 'explicit', 'not_rated');--> statement-breakpoint
CREATE TYPE "public"."contributor_role" AS ENUM('author', 'co_author', 'translator', 'editor');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('in_progress', 'completed', 'hiatus', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."library_entry_status" AS ENUM('not_started', 'reading', 'paused', 'completed', 'dropped', 'plan_to_read', 'dropped_as_abandoned');--> statement-breakpoint
CREATE TYPE "public"."reading_event_type" AS ENUM('started', 'progressed', 'rating_changed', 'reread_started', 'status_changed', 'completed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_effective_reason" AS ENUM('direct', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_relation_type" AS ENUM('broader', 'related', 'implies', 'conflicts_with', 'equivalent_to');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_term_status" AS ENUM('active', 'merged');--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"issuer" text NOT NULL,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impersonated_by" text,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"ban_expires" timestamp,
	"ban_reason" text,
	"banned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contributor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"name" "citext" NOT NULL,
	"normalized_name" text NOT NULL,
	"platform_handles" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contributor_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "contributor_platform_handles_is_object" CHECK ("contributor"."platform_handles" is null or jsonb_typeof("contributor"."platform_handles") = 'object')
);
--> statement-breakpoint
CREATE TABLE "source_platform" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"base_url" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "source_platform_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "source_platform_name_unique" UNIQUE("name"),
	CONSTRAINT "source_platform_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"content_rating" "content_rating" DEFAULT 'not_rated' NOT NULL,
	"description" text,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"publication_status" "publication_status" DEFAULT 'in_progress' NOT NULL,
	"sort_title" text NOT NULL,
	"summary" text,
	"title" "citext" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "work_contributor" (
	"contributor_id" uuid NOT NULL,
	"role" "contributor_role" NOT NULL,
	"work_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_contributor_work_id_contributor_id_role_pk" PRIMARY KEY("work_id","contributor_id","role")
);
--> statement-breakpoint
CREATE TABLE "work_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"chapter_count" integer,
	"external_id" text,
	"normalized_url" text NOT NULL,
	"raw_metadata" jsonb,
	"source_platform_id" uuid NOT NULL,
	"url" text NOT NULL,
	"word_count" integer,
	"work_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_source_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "work_source_raw_metadata_is_object" CHECK ("work_source"."raw_metadata" is null or jsonb_typeof("work_source"."raw_metadata") = 'object'),
	CONSTRAINT "work_source_word_count_non_negative" CHECK ("work_source"."word_count" >= 0),
	CONSTRAINT "work_source_chapter_count_non_negative" CHECK ("work_source"."chapter_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "library_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"display_order" integer,
	"favorite" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"priority" integer,
	"private" boolean DEFAULT false NOT NULL,
	"status" "library_entry_status" DEFAULT 'not_started' NOT NULL,
	"user_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"work_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "library_entry_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "reading_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"event_type" "reading_event_type" NOT NULL,
	"from_snapshot" jsonb,
	"library_entry_id" uuid NOT NULL,
	"metadata" jsonb,
	"to_snapshot" jsonb,
	CONSTRAINT "reading_event_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "reading_event_metadata_is_object" CHECK ("reading_event"."metadata" is null or jsonb_typeof("reading_event"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "reading_state" (
	"completed_at" timestamp,
	"current_chapter" integer,
	"last_read_at" timestamp,
	"library_entry_id" uuid PRIMARY KEY NOT NULL,
	"percent" numeric(5, 2),
	"rating" integer,
	"reread_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_kind" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_kind_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "taxonomy_kind_name_unique" UNIQUE("name"),
	CONSTRAINT "taxonomy_kind_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "taxonomy_label" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"label" "citext" NOT NULL,
	"taxonomy_term_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_label_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "taxonomy_relation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"from_term_id" uuid NOT NULL,
	"relation_type" "taxonomy_relation_type" NOT NULL,
	"to_term_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_relation_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "taxonomy_relation_no_self_edge" CHECK ("taxonomy_relation"."from_term_id" != "taxonomy_relation"."to_term_id")
);
--> statement-breakpoint
CREATE TABLE "taxonomy_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"merged_into_id" uuid,
	"name" "citext" NOT NULL,
	"normalized_name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "taxonomy_term_status" DEFAULT 'active' NOT NULL,
	"taxonomy_kind_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_term_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "work_taxonomy_assignment" (
	"taxonomy_term_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_taxonomy_assignment_work_id_taxonomy_term_id_pk" PRIMARY KEY("work_id","taxonomy_term_id")
);
--> statement-breakpoint
CREATE TABLE "work_taxonomy_effective" (
	"depth" integer NOT NULL,
	"reason" "taxonomy_effective_reason" NOT NULL,
	"taxonomy_term_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_taxonomy_effective_work_id_taxonomy_term_id_pk" PRIMARY KEY("work_id","taxonomy_term_id"),
	CONSTRAINT "work_taxonomy_effective_depth_bounded" CHECK ("work_taxonomy_effective"."depth" <= 4)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_contributor" ADD CONSTRAINT "work_contributor_contributor_id_contributor_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."contributor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_contributor" ADD CONSTRAINT "work_contributor_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_source" ADD CONSTRAINT "work_source_source_platform_id_source_platform_id_fk" FOREIGN KEY ("source_platform_id") REFERENCES "public"."source_platform"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_source" ADD CONSTRAINT "work_source_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entry" ADD CONSTRAINT "library_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entry" ADD CONSTRAINT "library_entry_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_event" ADD CONSTRAINT "reading_event_library_entry_id_library_entry_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_state" ADD CONSTRAINT "reading_state_library_entry_id_library_entry_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."library_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_label" ADD CONSTRAINT "taxonomy_label_taxonomy_term_id_taxonomy_term_id_fk" FOREIGN KEY ("taxonomy_term_id") REFERENCES "public"."taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_relation" ADD CONSTRAINT "taxonomy_relation_from_term_id_taxonomy_term_id_fk" FOREIGN KEY ("from_term_id") REFERENCES "public"."taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_relation" ADD CONSTRAINT "taxonomy_relation_to_term_id_taxonomy_term_id_fk" FOREIGN KEY ("to_term_id") REFERENCES "public"."taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_term" ADD CONSTRAINT "taxonomy_term_taxonomy_kind_id_taxonomy_kind_id_fk" FOREIGN KEY ("taxonomy_kind_id") REFERENCES "public"."taxonomy_kind"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_taxonomy_assignment" ADD CONSTRAINT "work_taxonomy_assignment_taxonomy_term_id_taxonomy_term_id_fk" FOREIGN KEY ("taxonomy_term_id") REFERENCES "public"."taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_taxonomy_assignment" ADD CONSTRAINT "work_taxonomy_assignment_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_taxonomy_effective" ADD CONSTRAINT "work_taxonomy_effective_taxonomy_term_id_taxonomy_term_id_fk" FOREIGN KEY ("taxonomy_term_id") REFERENCES "public"."taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_taxonomy_effective" ADD CONSTRAINT "work_taxonomy_effective_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "contributor_normalized_name_idx" ON "contributor" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "contributor_name_trgm_idx" ON "contributor" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "work_title_trgm_idx" ON "work" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "work_description_trgm_idx" ON "work" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "work_summary_trgm_idx" ON "work" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "work_contributor_contributor_id_idx" ON "work_contributor" USING btree ("contributor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_source_normalized_url_platform_uidx" ON "work_source" USING btree ("source_platform_id","normalized_url");--> statement-breakpoint
CREATE UNIQUE INDEX "work_source_external_id_platform_uidx" ON "work_source" USING btree ("source_platform_id","external_id") WHERE "work_source"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "work_source_work_id_idx" ON "work_source" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "work_source_url_trgm_idx" ON "work_source" USING gin ("url" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "library_entry_user_work_uidx" ON "library_entry" USING btree ("user_id","work_id");--> statement-breakpoint
CREATE INDEX "library_entry_status_idx" ON "library_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "library_entry_favorite_idx" ON "library_entry" USING btree ("user_id") WHERE "library_entry"."favorite" = true;--> statement-breakpoint
CREATE INDEX "library_entry_display_order_idx" ON "library_entry" USING btree ("is_featured","display_order") WHERE "library_entry"."is_featured" = true;--> statement-breakpoint
CREATE INDEX "reading_event_library_entry_id_idx" ON "reading_event" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX "reading_event_created_at_idx" ON "reading_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "taxonomy_label_term_id_idx" ON "taxonomy_label" USING btree ("taxonomy_term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_label_term_primary_uidx" ON "taxonomy_label" USING btree ("taxonomy_term_id") WHERE "taxonomy_label"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_label_term_label_uidx" ON "taxonomy_label" USING btree ("taxonomy_term_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_relation_from_to_type_uidx" ON "taxonomy_relation" USING btree ("from_term_id","to_term_id","relation_type");--> statement-breakpoint
CREATE INDEX "taxonomy_relation_to_term_id_idx" ON "taxonomy_relation" USING btree ("to_term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_term_kind_slug_uidx" ON "taxonomy_term" USING btree ("taxonomy_kind_id","slug");--> statement-breakpoint
CREATE INDEX "taxonomy_term_normalized_name_idx" ON "taxonomy_term" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "taxonomy_term_name_trgm_idx" ON "taxonomy_term" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "taxonomy_term_merged_into_id_idx" ON "taxonomy_term" USING btree ("merged_into_id");--> statement-breakpoint
CREATE INDEX "work_taxonomy_assignment_term_id_idx" ON "work_taxonomy_assignment" USING btree ("taxonomy_term_id");--> statement-breakpoint
CREATE INDEX "work_taxonomy_effective_term_id_idx" ON "work_taxonomy_effective" USING btree ("taxonomy_term_id");