CREATE TABLE `project` (
	`project_id` text PRIMARY KEY,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`github_owner` text,
	`github_repo` text,
	`vercel_project_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_project_org_id_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `org`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `project_domain` (
	`project_domain_id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`host` text NOT NULL,
	`base_path` text DEFAULT '/' NOT NULL,
	`platform` text DEFAULT 'detected' NOT NULL,
	`environment` text DEFAULT 'production' NOT NULL,
	`github_branch` text,
	`first_seen_at` integer,
	`last_seen_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_project_domain_project_id_project_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `api_key` ADD `project_id` text REFERENCES project(project_id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `api_key_project_id_idx` ON `api_key` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_org_id_idx` ON `project` (`org_id`);--> statement-breakpoint
CREATE INDEX `project_domain_project_id_idx` ON `project_domain` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_domain_host_base_path_unique` ON `project_domain` (`host`,`base_path`);