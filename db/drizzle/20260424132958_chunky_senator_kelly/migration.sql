CREATE TABLE `api_key` (
	`id` text PRIMARY KEY,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL UNIQUE,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_api_key_org_id_org_id_fk` FOREIGN KEY (`org_id`) REFERENCES `org`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `api_key_org_id_idx` ON `api_key` (`org_id`);