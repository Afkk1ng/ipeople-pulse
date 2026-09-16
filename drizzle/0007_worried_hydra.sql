CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shift_report_deliveries` (
	`shift_id` text PRIMARY KEY NOT NULL,
	`shift_date` text NOT NULL,
	`status` text NOT NULL,
	`sent_at` integer,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shift_report_deliveries_date` ON `shift_report_deliveries` (`shift_date`);