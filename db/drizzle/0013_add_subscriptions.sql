CREATE TABLE `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text NOT NULL,
	`customer_id` text,
	`price_id` text NOT NULL,
	`product_id` text,
	`status` text NOT NULL,
	`interval` text,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `org`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_subscription_id_unique` ON `subscription` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `subscription_org_id_idx` ON `subscription` (`org_id`);--> statement-breakpoint
CREATE INDEX `subscription_project_id_idx` ON `subscription` (`project_id`);--> statement-breakpoint
ALTER TABLE `org` ADD `stripe_customer_id` text;
