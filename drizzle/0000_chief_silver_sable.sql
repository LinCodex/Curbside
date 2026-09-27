CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cache_expiry` ON `cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`summons` text NOT NULL,
	`facts` text DEFAULT '' NOT NULL,
	`draft` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`approved_version` integer,
	`partner_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`generations` integer DEFAULT 0 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`receipt_key` text,
	`filing_reference` text,
	`outcome` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cases_owner` ON `cases` (`owner_id`);--> statement-breakpoint
CREATE INDEX `cases_partner` ON `cases` (`partner_id`);--> statement-breakpoint
CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`channel` text NOT NULL,
	`action` text NOT NULL,
	`version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dealers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text DEFAULT '#91b7ff' NOT NULL,
	`capacity` integer DEFAULT 100 NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`stripe_customer` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dealer_slug` ON `dealers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `dealer_owner` ON `dealers` (`owner_id`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_case` ON `evidence` (`case_id`);--> statement-breakpoint
CREATE TABLE `health` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`token` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`channel` text NOT NULL,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`not_before` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`provider_id` text,
	`lease_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `jobs_due` ON `jobs` (`status`,`not_before`);--> statement-breakpoint
CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dealer_member` ON `memberships` (`dealer_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`summons` text NOT NULL,
	`payload` text NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`local_status` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `observation_vehicle_summons` ON `observations` (`vehicle_id`,`summons`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`terms_version` text NOT NULL,
	`instructions` text NOT NULL,
	`authorization_required` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sponsorships` (
	`id` text PRIMARY KEY NOT NULL,
	`dealer_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sponsor_owner` ON `sponsorships` (`owner_id`);--> statement-breakpoint
CREATE INDEX `sponsor_dealer` ON `sponsorships` (`dealer_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`plan_until` integer DEFAULT 0 NOT NULL,
	`stripe_customer` text,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`email_alerts` integer DEFAULT 1 NOT NULL,
	`phone` text,
	`phone_verified` integer DEFAULT 0 NOT NULL,
	`sms_consent` integer DEFAULT 0 NOT NULL,
	`sms_stopped` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plate` text NOT NULL,
	`state` text NOT NULL,
	`plate_type` text DEFAULT '' NOT NULL,
	`plate_key` text NOT NULL,
	`nickname` text NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`monitoring` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`baseline_at` integer,
	`checked_at` integer,
	`next_check` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_owner_plate` ON `vehicles` (`owner_id`,`plate_key`);--> statement-breakpoint
CREATE INDEX `vehicles_due` ON `vehicles` (`monitoring`,`next_check`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`created_at` integer NOT NULL
);
