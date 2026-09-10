CREATE TABLE `audit_log` (
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`after` text,
	`before` text,
	`changed_columns` text NOT NULL,
	`created_at` integer NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT "audit_before_is_object" CHECK("audit_log"."before" is null or (json_valid("audit_log"."before") and json_type("audit_log"."before") = 'object')),
	CONSTRAINT "audit_after_is_object" CHECK("audit_log"."after" is null or (json_valid("audit_log"."after") and json_type("audit_log"."after") = 'object')),
	CONSTRAINT "audit_changed_columns_is_array" CHECK(json_valid("audit_log"."changed_columns") and json_type("audit_log"."changed_columns") = 'array'),
	CONSTRAINT "audit_entity_type_valid" CHECK("audit_log"."entity_type" in ('work', 'work_source', 'library_entry', 'taxonomy_term'))
);
--> statement-breakpoint
CREATE INDEX `audit_entity_time_idx` ON `audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `account` (
	`access_token` text,
	`access_token_expires_at` integer,
	`account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`id_token` text,
	`issuer` text,
	`password` text,
	`provider_id` text NOT NULL,
	`refresh_token` text,
	`refresh_token_expires_at` integer,
	`scope` text,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_account_id_uidx` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`impersonated_by` text,
	`ip_address` text,
	`token` text NOT NULL,
	`updated_at` integer NOT NULL,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`ban_expires` integer,
	`ban_reason` text,
	`banned` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "user_role_valid" CHECK("user"."role" in ('user', 'admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`updated_at` integer NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `contributor` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`name` text collate nocase NOT NULL,
	`normalized_name` text NOT NULL,
	`platform_handles` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "contributor_platform_handles_is_object" CHECK("contributor"."platform_handles" is null or (json_valid("contributor"."platform_handles") and json_type("contributor"."platform_handles") = 'object'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contributor_public_id_unique` ON `contributor` (`public_id`);--> statement-breakpoint
CREATE INDEX `contributor_normalized_name_idx` ON `contributor` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `source_platform` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`base_url` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_platform_public_id_unique` ON `source_platform` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_platform_name_unique` ON `source_platform` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `source_platform_slug_unique` ON `source_platform` (`slug`);--> statement-breakpoint
CREATE TABLE `work` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`content_rating` text DEFAULT 'not_rated' NOT NULL,
	`description` text,
	`is_nsfw` integer DEFAULT false NOT NULL,
	`publication_status` text DEFAULT 'in_progress' NOT NULL,
	`sort_title` text NOT NULL,
	`summary` text,
	`title` text collate nocase NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "work_content_rating_valid" CHECK("work"."content_rating" in ('general', 'teen', 'mature', 'explicit', 'not_rated')),
	CONSTRAINT "work_publication_status_valid" CHECK("work"."publication_status" in ('in_progress', 'completed', 'hiatus', 'abandoned'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_public_id_unique` ON `work` (`public_id`);--> statement-breakpoint
CREATE TABLE `work_contributor` (
	`contributor_id` text NOT NULL,
	`role` text NOT NULL,
	`work_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`work_id`, `contributor_id`, `role`),
	FOREIGN KEY (`contributor_id`) REFERENCES `contributor`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_contributor_role_valid" CHECK("work_contributor"."role" in ('author', 'co_author', 'translator', 'editor'))
);
--> statement-breakpoint
CREATE INDEX `work_contributor_contributor_id_idx` ON `work_contributor` (`contributor_id`);--> statement-breakpoint
CREATE TABLE `work_source` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`chapter_count` integer,
	`external_id` text,
	`normalized_url` text NOT NULL,
	`raw_metadata` text,
	`source_platform_id` text NOT NULL,
	`url` text NOT NULL,
	`word_count` integer,
	`work_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_platform_id`) REFERENCES `source_platform`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_source_raw_metadata_is_object" CHECK("work_source"."raw_metadata" is null or (json_valid("work_source"."raw_metadata") and json_type("work_source"."raw_metadata") = 'object')),
	CONSTRAINT "work_source_word_count_non_negative" CHECK("work_source"."word_count" >= 0),
	CONSTRAINT "work_source_chapter_count_non_negative" CHECK("work_source"."chapter_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_source_public_id_unique` ON `work_source` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_source_normalized_url_platform_uidx` ON `work_source` (`source_platform_id`,`normalized_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_source_external_id_platform_uidx` ON `work_source` (`source_platform_id`,`external_id`) WHERE "work_source"."external_id" is not null;--> statement-breakpoint
CREATE INDEX `work_source_work_id_idx` ON `work_source` (`work_id`);--> statement-breakpoint
CREATE TABLE `library_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`display_order` integer,
	`favorite` integer DEFAULT false NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`priority` integer,
	`private` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`user_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`work_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "library_entry_status_valid" CHECK("library_entry"."status" in ('not_started', 'reading', 'paused', 'completed', 'dropped', 'plan_to_read', 'dropped_as_abandoned', 'completed_as_axed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_entry_public_id_unique` ON `library_entry` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `library_entry_user_work_uidx` ON `library_entry` (`user_id`,`work_id`);--> statement-breakpoint
CREATE INDEX `library_entry_status_idx` ON `library_entry` (`status`);--> statement-breakpoint
CREATE INDEX `library_entry_favorite_idx` ON `library_entry` (`user_id`) WHERE "library_entry"."favorite" = true;--> statement-breakpoint
CREATE INDEX `library_entry_display_order_idx` ON `library_entry` (`is_featured`,`display_order`) WHERE "library_entry"."is_featured" = true;--> statement-breakpoint
CREATE TABLE `reading_event` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`event_type` text NOT NULL,
	`from_snapshot` text,
	`library_entry_id` text NOT NULL,
	`metadata` text,
	`to_snapshot` text,
	FOREIGN KEY (`library_entry_id`) REFERENCES `library_entry`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reading_event_metadata_is_object" CHECK("reading_event"."metadata" is null or (json_valid("reading_event"."metadata") and json_type("reading_event"."metadata") = 'object')),
	CONSTRAINT "reading_event_event_type_valid" CHECK("reading_event"."event_type" in ('started', 'progressed', 'rating_changed', 'reread_started', 'status_changed', 'completed', 'dropped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_event_public_id_unique` ON `reading_event` (`public_id`);--> statement-breakpoint
CREATE INDEX `reading_event_library_entry_id_idx` ON `reading_event` (`library_entry_id`);--> statement-breakpoint
CREATE INDEX `reading_event_created_at_idx` ON `reading_event` (`created_at`);--> statement-breakpoint
CREATE TABLE `reading_state` (
	`completed_at` integer,
	`current_chapter` integer,
	`last_read_at` integer,
	`library_entry_id` text PRIMARY KEY NOT NULL,
	`percent` real,
	`rating` real,
	`reread_count` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`library_entry_id`) REFERENCES `library_entry`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reading_state_rating_range" CHECK("reading_state"."rating" is null or ("reading_state"."rating" >= 1 and "reading_state"."rating" <= 10 and ("reading_state"."rating" * 2) = floor("reading_state"."rating" * 2)))
);
--> statement-breakpoint
CREATE TABLE `work_source_observation` (
	`chapter_count` integer,
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`publication_status` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`word_count` integer,
	`work_id` text NOT NULL,
	`work_source_id` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_source_id`) REFERENCES `work_source`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "wso_word_count_non_negative" CHECK("work_source_observation"."word_count" >= 0),
	CONSTRAINT "wso_chapter_count_non_negative" CHECK("work_source_observation"."chapter_count" >= 0),
	CONSTRAINT "wso_publication_status_valid" CHECK("work_source_observation"."publication_status" in ('in_progress', 'completed', 'hiatus', 'abandoned')),
	CONSTRAINT "wso_source_valid" CHECK("work_source_observation"."source" in ('manual', 'refresh', 'import'))
);
--> statement-breakpoint
CREATE INDEX `wso_source_time_idx` ON `work_source_observation` (`work_source_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `device_identity` (
	`created_at` integer NOT NULL,
	`device_id` text NOT NULL,
	`id` text PRIMARY KEY DEFAULT 'self' NOT NULL,
	`private_key_pkcs8` text NOT NULL,
	`public_key_raw` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_identity_device_id_unique` ON `device_identity` (`device_id`);--> statement-breakpoint
CREATE TABLE `known_peer` (
	`created_at` integer NOT NULL,
	`device_id` text NOT NULL,
	`last_synced_hlc` text,
	`port` integer NOT NULL,
	`public_key` text NOT NULL,
	`tailnet_hostname` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `known_peer_device_id_uidx` ON `known_peer` (`device_id`);--> statement-breakpoint
CREATE TABLE `oplog` (
	`column_diffs` text NOT NULL,
	`device_id` text NOT NULL,
	`hlc_timestamp` text NOT NULL,
	`row_id` text NOT NULL,
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`tombstone` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oplog_hlc_timestamp_uidx` ON `oplog` (`hlc_timestamp`);--> statement-breakpoint
CREATE TABLE `taxonomy_kind` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_kind_public_id_unique` ON `taxonomy_kind` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_kind_name_unique` ON `taxonomy_kind` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_kind_slug_unique` ON `taxonomy_kind` (`slug`);--> statement-breakpoint
CREATE TABLE `taxonomy_label` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`label` text collate nocase NOT NULL,
	`taxonomy_term_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`taxonomy_term_id`) REFERENCES `taxonomy_term`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_label_public_id_unique` ON `taxonomy_label` (`public_id`);--> statement-breakpoint
CREATE INDEX `taxonomy_label_term_id_idx` ON `taxonomy_label` (`taxonomy_term_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_label_term_primary_uidx` ON `taxonomy_label` (`taxonomy_term_id`) WHERE "taxonomy_label"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_label_term_label_uidx` ON `taxonomy_label` (`taxonomy_term_id`,`label`);--> statement-breakpoint
CREATE TABLE `taxonomy_relation` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`from_term_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`to_term_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`from_term_id`) REFERENCES `taxonomy_term`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_term_id`) REFERENCES `taxonomy_term`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "taxonomy_relation_no_self_edge" CHECK("taxonomy_relation"."from_term_id" != "taxonomy_relation"."to_term_id"),
	CONSTRAINT "taxonomy_relation_type_valid" CHECK("taxonomy_relation"."relation_type" in ('broader', 'related', 'implies', 'conflicts_with', 'equivalent_to'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_relation_public_id_unique` ON `taxonomy_relation` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_relation_from_to_type_uidx` ON `taxonomy_relation` (`from_term_id`,`to_term_id`,`relation_type`);--> statement-breakpoint
CREATE INDEX `taxonomy_relation_to_term_id_idx` ON `taxonomy_relation` (`to_term_id`);--> statement-breakpoint
CREATE TABLE `taxonomy_term` (
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
	CONSTRAINT "taxonomy_term_status_valid" CHECK("taxonomy_term"."status" in ('active', 'merged'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_term_public_id_unique` ON `taxonomy_term` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `taxonomy_term_kind_slug_uidx` ON `taxonomy_term` (`taxonomy_kind_id`,`slug`);--> statement-breakpoint
CREATE INDEX `taxonomy_term_normalized_name_idx` ON `taxonomy_term` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `taxonomy_term_merged_into_id_idx` ON `taxonomy_term` (`merged_into_id`);--> statement-breakpoint
CREATE TABLE `work_taxonomy_assignment` (
	`taxonomy_term_id` text NOT NULL,
	`work_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`work_id`, `taxonomy_term_id`),
	FOREIGN KEY (`taxonomy_term_id`) REFERENCES `taxonomy_term`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `work_taxonomy_assignment_term_id_idx` ON `work_taxonomy_assignment` (`taxonomy_term_id`);--> statement-breakpoint
CREATE TABLE `work_taxonomy_effective` (
	`depth` integer NOT NULL,
	`reason` text NOT NULL,
	`taxonomy_term_id` text NOT NULL,
	`work_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`work_id`, `taxonomy_term_id`),
	FOREIGN KEY (`taxonomy_term_id`) REFERENCES `taxonomy_term`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `work`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "work_taxonomy_effective_depth_bounded" CHECK("work_taxonomy_effective"."depth" <= 4),
	CONSTRAINT "work_taxonomy_effective_reason_valid" CHECK("work_taxonomy_effective"."reason" in ('direct', 'inferred'))
);
--> statement-breakpoint
CREATE INDEX `work_taxonomy_effective_term_id_idx` ON `work_taxonomy_effective` (`taxonomy_term_id`);