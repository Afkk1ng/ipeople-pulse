CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`employee` text NOT NULL,
	`shift_date` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`total_pay` integer NOT NULL,
	`payload` text NOT NULL
);
