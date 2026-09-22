CREATE TABLE `sync_repair_history` (
	`attempted_at` integer NOT NULL,
	`converged` integer NOT NULL,
	`device_id` text NOT NULL,
	`error` text,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`outcome` text,
	`rows_repaired` integer NOT NULL,
	`tables` text NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "sync_repair_history_trigger_check" CHECK("sync_repair_history"."trigger" in ('manual', 'auto'))
);
--> statement-breakpoint
ALTER TABLE `library_entry` ADD `deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reading_state` ADD `deleted` integer DEFAULT false NOT NULL;