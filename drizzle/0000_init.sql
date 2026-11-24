CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_id` integer NOT NULL,
	`type` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `llm_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`latency_ms` real NOT NULL,
	`ok` integer NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_id` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mood_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_id` integer NOT NULL,
	`mood` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `objects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`name` text NOT NULL,
	`traits_json` text NOT NULL,
	`voice_json` text NOT NULL,
	`mood` integer DEFAULT 60 NOT NULL,
	`last_bbox_json` text NOT NULL,
	`last_ocr` text DEFAULT '' NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`times_seen` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_a` integer NOT NULL,
	`object_b` integer NOT NULL,
	`kind` text NOT NULL,
	`strength` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`object_a`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`object_b`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_path` text,
	`mode` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`raw_mirage_json` text NOT NULL,
	`latency_ms` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sightings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_id` integer NOT NULL,
	`scan_id` integer NOT NULL,
	`bbox_json` text NOT NULL,
	`mask_ref` text,
	`ocr_text` text DEFAULT '' NOT NULL,
	`match_confidence` real NOT NULL,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`object_id` integer NOT NULL,
	`content` text NOT NULL,
	`reply` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`object_id`) REFERENCES `objects`(`id`) ON UPDATE no action ON DELETE cascade
);
