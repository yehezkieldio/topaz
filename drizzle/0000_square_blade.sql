CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE TABLE "topaz_library_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"user_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"status" text DEFAULT 'Reading' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"private" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_reading_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"library_entry_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"from_chapter" integer,
	"to_chapter" integer,
	"from_rating" numeric(2, 1),
	"to_rating" numeric(2, 1),
	"event_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "reading_event_metadata_object" CHECK (jsonb_typeof("topaz_reading_event"."metadata") = 'object'),
	CONSTRAINT "reading_event_from_chapter_nonnegative" CHECK ("topaz_reading_event"."from_chapter" IS NULL OR "topaz_reading_event"."from_chapter" >= 0),
	CONSTRAINT "reading_event_to_chapter_nonnegative" CHECK ("topaz_reading_event"."to_chapter" IS NULL OR "topaz_reading_event"."to_chapter" >= 0),
	CONSTRAINT "reading_event_from_rating_range" CHECK ("topaz_reading_event"."from_rating" IS NULL OR ("topaz_reading_event"."from_rating" >= 0 AND "topaz_reading_event"."from_rating" <= 5)),
	CONSTRAINT "reading_event_to_rating_range" CHECK ("topaz_reading_event"."to_rating" IS NULL OR ("topaz_reading_event"."to_rating" >= 0 AND "topaz_reading_event"."to_rating" <= 5))
);
--> statement-breakpoint
CREATE TABLE "topaz_reading_state" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"library_entry_id" uuid NOT NULL,
	"current_chapter" integer DEFAULT 0 NOT NULL,
	"current_percent" numeric(5, 2),
	"rating" numeric(2, 1),
	"notes" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_read_at" timestamp with time zone,
	"reread_count" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone,
	CONSTRAINT "reading_state_rating_range" CHECK ("topaz_reading_state"."rating" IS NULL OR ("topaz_reading_state"."rating" >= 0 AND "topaz_reading_state"."rating" <= 5)),
	CONSTRAINT "reading_state_current_percent_range" CHECK ("topaz_reading_state"."current_percent" IS NULL OR ("topaz_reading_state"."current_percent" >= 0 AND "topaz_reading_state"."current_percent" <= 100)),
	CONSTRAINT "reading_state_current_chapter_nonnegative" CHECK ("topaz_reading_state"."current_chapter" >= 0),
	CONSTRAINT "reading_state_reread_count_nonnegative" CHECK ("topaz_reading_state"."reread_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "topaz_contributor" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"name" "citext" NOT NULL,
	"sort_name" text NOT NULL,
	"platform_handles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone,
	CONSTRAINT "contributor_platform_handles_object" CHECK (jsonb_typeof("topaz_contributor"."platform_handles") = 'object')
);
--> statement-breakpoint
CREATE TABLE "topaz_source_platform" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_work_contributor" (
	"work_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"role" text DEFAULT 'author' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "topaz_work_contributor_work_id_contributor_id_role_pk" PRIMARY KEY("work_id","contributor_id","role")
);
--> statement-breakpoint
CREATE TABLE "topaz_work_source" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"work_id" uuid NOT NULL,
	"source_platform_id" uuid NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"external_id" text,
	"title_on_source" text,
	"author_on_source" text,
	"chapter_count" integer,
	"word_count" integer,
	"source_status" text DEFAULT 'Unknown' NOT NULL,
	"first_published_at" timestamp with time zone,
	"last_updated_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"raw_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone,
	CONSTRAINT "work_source_chapter_count_nonnegative" CHECK ("topaz_work_source"."chapter_count" IS NULL OR "topaz_work_source"."chapter_count" >= 0),
	CONSTRAINT "work_source_word_count_nonnegative" CHECK ("topaz_work_source"."word_count" IS NULL OR "topaz_work_source"."word_count" >= 0),
	CONSTRAINT "work_source_raw_metadata_object" CHECK (jsonb_typeof("topaz_work_source"."raw_metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "topaz_work" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"title" "citext" NOT NULL,
	"sort_title" text NOT NULL,
	"description" text,
	"summary" text,
	"publication_status" text DEFAULT 'Unknown' NOT NULL,
	"content_rating" text DEFAULT 'unknown' NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_taxonomy_kind" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_assignable" boolean DEFAULT true NOT NULL,
	"allows_relations" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_taxonomy_label" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"term_id" uuid NOT NULL,
	"label" "citext" NOT NULL,
	"normalized_label" text NOT NULL,
	"label_type" text DEFAULT 'alias' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_searchable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_taxonomy_relation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"from_term_id" uuid NOT NULL,
	"to_term_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone,
	CONSTRAINT "taxonomy_relation_no_self_edge" CHECK ("topaz_taxonomy_relation"."from_term_id" <> "topaz_taxonomy_relation"."to_term_id")
);
--> statement-breakpoint
CREATE TABLE "topaz_taxonomy_term" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_id" varchar(128) NOT NULL,
	"kind_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" "citext" NOT NULL,
	"normalized_name" text NOT NULL,
	"description" text,
	"disambiguation" text,
	"status" text DEFAULT 'active' NOT NULL,
	"merged_into_id" uuid,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "topaz_work_taxonomy_assignment" (
	"work_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "topaz_work_taxonomy_assignment_work_id_term_id_pk" PRIMARY KEY("work_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "topaz_work_taxonomy_effective" (
	"work_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"source_term_id" uuid,
	"reason" text NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "topaz_work_taxonomy_effective_work_id_term_id_pk" PRIMARY KEY("work_id","term_id"),
	CONSTRAINT "work_taxonomy_effective_depth_nonnegative" CHECK ("topaz_work_taxonomy_effective"."depth" >= 0)
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
ALTER TABLE "topaz_library_entry" ADD CONSTRAINT "topaz_library_entry_user_id_topaz_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."topaz_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_library_entry" ADD CONSTRAINT "topaz_library_entry_work_id_topaz_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."topaz_work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_reading_event" ADD CONSTRAINT "topaz_reading_event_library_entry_id_topaz_library_entry_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."topaz_library_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_reading_state" ADD CONSTRAINT "topaz_reading_state_library_entry_id_topaz_library_entry_id_fk" FOREIGN KEY ("library_entry_id") REFERENCES "public"."topaz_library_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_contributor" ADD CONSTRAINT "topaz_work_contributor_work_id_topaz_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."topaz_work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_contributor" ADD CONSTRAINT "topaz_work_contributor_contributor_id_topaz_contributor_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."topaz_contributor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_source" ADD CONSTRAINT "topaz_work_source_work_id_topaz_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."topaz_work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_source" ADD CONSTRAINT "topaz_work_source_source_platform_id_topaz_source_platform_id_fk" FOREIGN KEY ("source_platform_id") REFERENCES "public"."topaz_source_platform"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_taxonomy_label" ADD CONSTRAINT "topaz_taxonomy_label_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_taxonomy_relation" ADD CONSTRAINT "topaz_taxonomy_relation_from_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("from_term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_taxonomy_relation" ADD CONSTRAINT "topaz_taxonomy_relation_to_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("to_term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_taxonomy_term" ADD CONSTRAINT "topaz_taxonomy_term_kind_id_topaz_taxonomy_kind_id_fk" FOREIGN KEY ("kind_id") REFERENCES "public"."topaz_taxonomy_kind"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_taxonomy_term" ADD CONSTRAINT "topaz_taxonomy_term_merged_into_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_taxonomy_assignment" ADD CONSTRAINT "topaz_work_taxonomy_assignment_work_id_topaz_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."topaz_work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_taxonomy_assignment" ADD CONSTRAINT "topaz_work_taxonomy_assignment_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_taxonomy_effective" ADD CONSTRAINT "topaz_work_taxonomy_effective_work_id_topaz_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."topaz_work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_taxonomy_effective" ADD CONSTRAINT "topaz_work_taxonomy_effective_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_work_taxonomy_effective" ADD CONSTRAINT "topaz_work_taxonomy_effective_source_term_id_topaz_taxonomy_term_id_fk" FOREIGN KEY ("source_term_id") REFERENCES "public"."topaz_taxonomy_term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_account" ADD CONSTRAINT "topaz_account_user_id_topaz_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."topaz_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topaz_session" ADD CONSTRAINT "topaz_session_user_id_topaz_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."topaz_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "library_entry_public_id_uidx" ON "topaz_library_entry" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "library_entry_user_work_uidx" ON "topaz_library_entry" USING btree ("user_id","work_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "library_entry_user_idx" ON "topaz_library_entry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "library_entry_work_idx" ON "topaz_library_entry" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "library_entry_user_status_idx" ON "topaz_library_entry" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "library_entry_user_updated_idx" ON "topaz_library_entry" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "reading_event_public_id_uidx" ON "topaz_reading_event" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "reading_event_library_entry_idx" ON "topaz_reading_event" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "reading_event_event_at_idx" ON "topaz_reading_event" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "reading_event_library_entry_event_at_idx" ON "topaz_reading_event" USING btree ("library_entry_id","event_at");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "reading_state_public_id_uidx" ON "topaz_reading_state" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "reading_state_library_entry_uidx" ON "topaz_reading_state" USING btree ("library_entry_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "reading_state_library_entry_idx" ON "topaz_reading_state" USING btree ("library_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "contributor_public_id_uidx" ON "topaz_contributor" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "contributor_sort_name_idx" ON "topaz_contributor" USING btree ("sort_name");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "contributor_name_trgm_idx" ON "topaz_contributor" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "source_platform_public_id_uidx" ON "topaz_source_platform" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "source_platform_key_uidx" ON "topaz_source_platform" USING btree ("key");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_contributor_contributor_idx" ON "topaz_work_contributor" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_contributor_work_idx" ON "topaz_work_contributor" USING btree ("work_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "work_source_public_id_uidx" ON "topaz_work_source" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "work_source_platform_normalized_url_uidx" ON "topaz_work_source" USING btree ("source_platform_id","normalized_url");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "work_source_platform_external_id_uidx" ON "topaz_work_source" USING btree ("source_platform_id","external_id") WHERE "topaz_work_source"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_source_work_idx" ON "topaz_work_source" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_source_platform_idx" ON "topaz_work_source" USING btree ("source_platform_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_source_primary_idx" ON "topaz_work_source" USING btree ("work_id","is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "work_public_id_uidx" ON "topaz_work" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_sort_title_idx" ON "topaz_work" USING btree ("sort_title");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_publication_status_idx" ON "topaz_work" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_created_at_idx" ON "topaz_work" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_updated_at_idx" ON "topaz_work" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_kind_public_id_uidx" ON "topaz_taxonomy_kind" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_kind_key_uidx" ON "topaz_taxonomy_kind" USING btree ("key");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_kind_sort_order_idx" ON "topaz_taxonomy_kind" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_label_public_id_uidx" ON "topaz_taxonomy_label" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_label_term_normalized_uidx" ON "topaz_taxonomy_label" USING btree ("term_id","normalized_label");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_label_primary_term_uidx" ON "topaz_taxonomy_label" USING btree ("term_id") WHERE "topaz_taxonomy_label"."is_primary" = true;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_label_normalized_idx" ON "topaz_taxonomy_label" USING btree ("normalized_label");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_label_term_idx" ON "topaz_taxonomy_label" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_label_label_trgm_idx" ON "topaz_taxonomy_label" USING gin ("label" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_relation_public_id_uidx" ON "topaz_taxonomy_relation" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_relation_edge_uidx" ON "topaz_taxonomy_relation" USING btree ("from_term_id","to_term_id","relation_type");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_relation_from_idx" ON "topaz_taxonomy_relation" USING btree ("from_term_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_relation_to_idx" ON "topaz_taxonomy_relation" USING btree ("to_term_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_relation_type_idx" ON "topaz_taxonomy_relation" USING btree ("relation_type");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_term_public_id_uidx" ON "topaz_taxonomy_term" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_term_kind_slug_uidx" ON "topaz_taxonomy_term" USING btree ("kind_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX CONCURRENTLY "taxonomy_term_kind_active_normalized_name_uidx" ON "topaz_taxonomy_term" USING btree ("kind_id","normalized_name") WHERE "topaz_taxonomy_term"."status" = 'active';--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_term_kind_idx" ON "topaz_taxonomy_term" USING btree ("kind_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_term_merged_into_idx" ON "topaz_taxonomy_term" USING btree ("merged_into_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_term_name_trgm_idx" ON "topaz_taxonomy_term" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomy_term_slug_trgm_idx" ON "topaz_taxonomy_term" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_taxonomy_assignment_work_idx" ON "topaz_work_taxonomy_assignment" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_taxonomy_assignment_term_idx" ON "topaz_work_taxonomy_assignment" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_taxonomy_effective_work_idx" ON "topaz_work_taxonomy_effective" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_taxonomy_effective_term_idx" ON "topaz_work_taxonomy_effective" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_taxonomy_effective_source_term_idx" ON "topaz_work_taxonomy_effective" USING btree ("source_term_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_taxonomy_effective_reason_idx" ON "topaz_work_taxonomy_effective" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "topaz_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "t_user_id_idx" ON "topaz_session" USING btree ("user_id");
