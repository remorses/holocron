PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_key` (
	`id` text PRIMARY KEY,
	`org_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL UNIQUE,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_api_key_org_id_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `org`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_api_key_project_id_project_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON DELETE CASCADE
);--> statement-breakpoint
INSERT INTO `__new_api_key`(`id`, `org_id`, `project_id`, `name`, `prefix`, `hash`, `created_at`) SELECT `id`, `org_id`, `project_id`, `name`, `prefix`, `hash`, `created_at` FROM `api_key`;--> statement-breakpoint
DROP TABLE `api_key`;--> statement-breakpoint
ALTER TABLE `__new_api_key` RENAME TO `api_key`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `api_key_org_id_idx` ON `api_key` (`org_id`);--> statement-breakpoint
CREATE INDEX `api_key_project_id_idx` ON `api_key` (`project_id`);
