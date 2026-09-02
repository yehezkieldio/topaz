CREATE INDEX CONCURRENTLY "reading_state_notes_trgm_idx" ON "topaz_reading_state" USING gin ("notes" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_source_title_on_source_trgm_idx" ON "topaz_work_source" USING gin ("title_on_source" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_source_author_on_source_trgm_idx" ON "topaz_work_source" USING gin ("author_on_source" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_title_trgm_idx" ON "topaz_work" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_description_trgm_idx" ON "topaz_work" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX CONCURRENTLY "work_summary_trgm_idx" ON "topaz_work" USING gin ("summary" gin_trgm_ops);