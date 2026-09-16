CREATE TABLE `employee_aliases` (
	`normalized_alias` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_employee_aliases_employee` ON `employee_aliases` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employee_color_rules` (
	`color_hex` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_employee_colors_employee` ON `employee_color_rules` (`employee_id`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payroll_rule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`effective_from` text NOT NULL,
	`rules_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`source_title` text NOT NULL,
	`source_fingerprint` text NOT NULL,
	`imported_at` integer NOT NULL,
	`imported_by` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`status` text DEFAULT 'review' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`source_row_id` text NOT NULL,
	`sale_date` text NOT NULL,
	`transaction_id` text NOT NULL,
	`item_name` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`employee_id` text,
	`employee_name_raw` text,
	`source_color` text,
	`resolution` text NOT NULL,
	`approved_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sales_rows_import` ON `sales_rows` (`import_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_rows_employee_date` ON `sales_rows` (`employee_id`,`sale_date`);--> statement-breakpoint
CREATE INDEX `idx_sales_rows_review` ON `sales_rows` (`import_id`,`resolution`);