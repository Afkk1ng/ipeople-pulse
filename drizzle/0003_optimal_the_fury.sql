CREATE TABLE `team_moods` (
	`employee` text NOT NULL,
	`shift_date` text NOT NULL,
	`mood` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`employee`, `shift_date`)
);
