CREATE TABLE `sync_integrity_check` (
	`checked_at` integer NOT NULL,
	`device_id` text PRIMARY KEY NOT NULL,
	`mismatched_tables` text NOT NULL
);
