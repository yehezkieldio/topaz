CREATE TABLE "work_source_observation" (
	"chapter_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_status" "publication_status",
	"source" text DEFAULT 'manual' NOT NULL,
	"word_count" integer,
	"work_id" uuid NOT NULL,
	"work_source_id" uuid NOT NULL,
	CONSTRAINT "wso_word_count_non_negative" CHECK ("work_source_observation"."word_count" >= 0),
	CONSTRAINT "wso_chapter_count_non_negative" CHECK ("work_source_observation"."chapter_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "work_source_observation" ADD CONSTRAINT "work_source_observation_work_id_work_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."work"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_source_observation" ADD CONSTRAINT "work_source_observation_work_source_id_work_source_id_fk" FOREIGN KEY ("work_source_id") REFERENCES "public"."work_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wso_source_time_idx" ON "work_source_observation" USING btree ("work_source_id","created_at");--> statement-breakpoint
CREATE INDEX "wso_created_brin_idx" ON "work_source_observation" USING brin ("created_at");