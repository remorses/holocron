-- Partner org plan, org-scoped API keys, project source/externalId for multi-tenant control planes.
ALTER TABLE `org` ADD `plan` text DEFAULT 'free' NOT NULL;
--> statement-breakpoint
ALTER TABLE `project` ADD `source` text;
--> statement-breakpoint
ALTER TABLE `project` ADD `external_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `project_org_id_external_id_unique` ON `project` (`org_id`, `external_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_api_key` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text,
	`scope` text NOT NULL DEFAULT 'project',
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `org`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON UPDATE no action ON DELETE cascade,
	CHECK (
		(`scope` = 'org' AND `project_id` IS NULL)
		OR
		(`scope` = 'project' AND `project_id` IS NOT NULL)
	)
);
--> statement-breakpoint
INSERT INTO `__new_api_key`(`id`, `org_id`, `project_id`, `scope`, `name`, `prefix`, `hash`, `created_at`)
SELECT `id`, `org_id`, `project_id`, 'project', `name`, `prefix`, `hash`, `created_at` FROM `api_key`;
--> statement-breakpoint
DROP TABLE `api_key`;
--> statement-breakpoint
ALTER TABLE `__new_api_key` RENAME TO `api_key`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `api_key_hash_unique` ON `api_key` (`hash`);
--> statement-breakpoint
CREATE INDEX `api_key_org_id_idx` ON `api_key` (`org_id`);
--> statement-breakpoint
CREATE INDEX `api_key_project_id_idx` ON `api_key` (`project_id`);
