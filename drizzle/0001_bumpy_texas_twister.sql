CREATE TABLE `queue_approaches` (
	`id` text PRIMARY KEY NOT NULL,
	`employee` text NOT NULL,
	`shift_date` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `queue_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`employee` text NOT NULL,
	`position` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `queue_entries_employee_unique` ON `queue_entries` (`employee`);--> statement-breakpoint
CREATE TABLE `queue_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
