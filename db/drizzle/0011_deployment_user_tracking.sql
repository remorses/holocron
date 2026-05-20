ALTER TABLE deployment ADD COLUMN triggered_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE deployment ADD COLUMN github_actor TEXT;
