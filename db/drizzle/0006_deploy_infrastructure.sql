CREATE TABLE `deployment` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` text NOT NULL,
	`status` text NOT NULL DEFAULT 'uploading',
	`files` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON DELETE CASCADE
);--> statement-breakpoint
CREATE INDEX `deployment_project_id_idx` ON `deployment` (`project_id`);--> statement-breakpoint
ALTER TABLE `project` ADD `subdomain` text;--> statement-breakpoint
CREATE UNIQUE INDEX `project_subdomain_unique` ON `project` (`subdomain`);--> statement-breakpoint
ALTER TABLE `project` ADD `current_deployment_id` text;
