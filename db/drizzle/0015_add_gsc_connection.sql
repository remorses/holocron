CREATE TABLE `gsc_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `project`(`project_id`) ON DELETE cascade,
	`oauth_app_id` text NOT NULL,
	`google_email` text,
	`site_url` text,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gsc_connection_project_id_unique` ON `gsc_connection` (`project_id`);
--> statement-breakpoint
CREATE INDEX `gsc_connection_project_id_idx` ON `gsc_connection` (`project_id`);
