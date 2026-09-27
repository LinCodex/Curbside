CREATE TABLE `notification_events` (
	`key` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`created_at` integer NOT NULL
);
