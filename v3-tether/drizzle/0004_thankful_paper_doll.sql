PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_taxonomy_term` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`merged_into_id` text,
	`name` text collate nocase NOT NULL,
	`normalized_name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`taxonomy_kind_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`taxonomy_kind_id`) REFERENCES `taxonomy_kind`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "taxonomy_term_status_valid" CHECK("__new_taxonomy_term"."status" in ('active', 'merged', 'deleted'))
);
--> statement-breakpoint
INSERT INTO `__new_taxonomy_term`("id", "public_id", "merged_into_id", "name", "normalized_name", "slug", "status", "taxonomy_kind_id", "version", "created_at", "updated_at") SELECT "id", "public_id", "merged_into_id", "name", "normalized_name", "slug", "status", "taxonomy_kind_id", "version", "created_at", "updated_at" FROM `taxonomy_term`;--> statement-breakpoint
DROP TABLE `taxonomy_term`;--> statement-breakpoint
ALTER TABLE `__new_taxonomy_term` RENAME TO `taxonomy_term`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_term_public_id_unique` ON `taxonomy_term` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_term_kind_slug_uidx` ON `taxonomy_term` (`taxonomy_kind_id`,`slug`);--> statement-breakpoint
CREATE INDEX `taxonomy_term_normalized_name_idx` ON `taxonomy_term` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `taxonomy_term_merged_into_id_idx` ON `taxonomy_term` (`merged_into_id`);--> statement-breakpoint
ALTER TABLE `work` ADD `deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `work_source` ADD `deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `work_source` ADD `version` integer DEFAULT 1 NOT NULL;