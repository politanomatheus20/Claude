CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sector` text DEFAULT 'privado' NOT NULL,
	`document` text,
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`notes` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE TABLE `contract_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`reason` text,
	`file_id` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contract_versions_uq` ON `contract_versions` (`contract_id`,`version`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`kind` text DEFAULT 'principal' NOT NULL,
	`code` text,
	`description` text,
	`signed_at` text,
	`start_at` text,
	`end_at` text,
	`quantity` integer,
	`payment_type` text NOT NULL,
	`proposal_2027_monthly_cents` integer,
	`licenses_monthly_cents` integer,
	`licenses_annual_override_cents` integer,
	`tax_override_cents` integer,
	`claude_monthly_cents` integer,
	`claude_annual_override_cents` integer,
	`iof_override_cents` integer,
	`license_total_override_cents` integer,
	`support_cents` integer DEFAULT 0 NOT NULL,
	`training_cents` integer DEFAULT 0 NOT NULL,
	`action` text,
	`billing_status` text DEFAULT 'pendente' NOT NULL,
	`license_status` text DEFAULT 'pendente' NOT NULL,
	`owner` text,
	`payment_method` text,
	`installments` integer,
	`installment_override_cents` integer,
	`received_cents` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contracts_client_idx` ON `contracts` (`client_id`);--> statement-breakpoint
CREATE INDEX `contracts_signed_idx` ON `contracts` (`signed_at`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`contract_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`uploaded_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_client_idx` ON `files` (`client_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`month` text PRIMARY KEY NOT NULL,
	`target_cents` integer NOT NULL,
	`updated_by` text,
	`updated_at` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`contract_id` text,
	`number` text NOT NULL,
	`description` text,
	`issue_date` text NOT NULL,
	`due_date` text,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`file_id` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoices_client_idx` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);