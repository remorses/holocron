ALTER TABLE `deployment` ADD `branch` text DEFAULT 'main';--> statement-breakpoint
ALTER TABLE `deployment` ADD `preview` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `deployment` ADD `subdomain` text;--> statement-breakpoint
CREATE INDEX `deployment_subdomain_idx` ON `deployment` (`subdomain`);--> statement-breakpoint
ALTER TABLE `project` ADD `default_branch` text DEFAULT 'main';--> statement-breakpoint
UPDATE `deployment` SET `subdomain` = (
  SELECT `subdomain` FROM `project` WHERE `project`.`project_id` = `deployment`.`project_id`
) WHERE `status` = 'active' AND `subdomain` IS NULL;
