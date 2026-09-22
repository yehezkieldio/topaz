ALTER TABLE `work` ADD `primary_author_id` text REFERENCES contributor(id);--> statement-breakpoint
ALTER TABLE `work` ADD `primary_source_id` text REFERENCES work_source(id);--> statement-breakpoint
-- Backfill for rows that existed before these pointer columns did -- mirrors
-- recomputeWorkPrimaryPointers's selection rule (src/server/db/primary-pointers.ts)
-- exactly, so existing data reads the same "primary" source/author the app
-- would compute for a fresh write.
UPDATE `work` SET `primary_source_id` = (
	SELECT `id` FROM `work_source`
	WHERE `work_source`.`work_id` = `work`.`id` AND `work_source`.`deleted` = 0
	ORDER BY `work_source`.`created_at` ASC
	LIMIT 1
);--> statement-breakpoint
UPDATE `work` SET `primary_author_id` = (
	SELECT `contributor`.`id` FROM `work_contributor`
	INNER JOIN `contributor` ON `contributor`.`id` = `work_contributor`.`contributor_id`
	WHERE `work_contributor`.`work_id` = `work`.`id` AND `work_contributor`.`role` = 'author'
	ORDER BY `contributor`.`name` ASC
	LIMIT 1
);