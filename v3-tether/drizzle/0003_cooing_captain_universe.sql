CREATE TABLE "audit_log" (
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"after" jsonb,
	"before" jsonb,
	"changed_columns" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "audit_before_is_object" CHECK ("audit_log"."before" is null or jsonb_typeof("audit_log"."before") = 'object'),
	CONSTRAINT "audit_after_is_object" CHECK ("audit_log"."after" is null or jsonb_typeof("audit_log"."after") = 'object')
);
--> statement-breakpoint
CREATE INDEX "audit_entity_time_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_created_brin_idx" ON "audit_log" USING brin ("created_at");