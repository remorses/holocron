CREATE TABLE `domain` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `project`(`project_id`) ON DELETE CASCADE,
	`hostname` text NOT NULL,
	`cloudflare_id` text,
	`status` text NOT NULL DEFAULT 'pending',
	`ssl_status` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `domain_hostname_unique` ON `domain` (`hostname`);
CREATE INDEX `domain_project_id_idx` ON `domain` (`project_id`);
