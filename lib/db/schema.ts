import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = () => integer({ mode: "number" }).notNull().default(sql`(unixepoch() * 1000)`);
const id = () => integer().primaryKey({ autoIncrement: true });

export const scans = sqliteTable("scans", {
  id: id(),
  imagePath: text("image_path"),
  mode: text({ enum: ["live", "upload"] }).notNull(),
  createdAt: now(),
  rawMirageJson: text("raw_mirage_json").notNull(),
  latencyMs: real("latency_ms").notNull(),
});

export const objects = sqliteTable("objects", {
  id: id(),
  label: text().notNull(),
  name: text().notNull(),
  traitsJson: text("traits_json").notNull(),
  voiceJson: text("voice_json").notNull(),
  mood: integer().notNull().default(60),
  // Last known box, used for matching across scans and sessions.
  lastBboxJson: text("last_bbox_json").notNull(),
  lastOcr: text("last_ocr").notNull().default(""),
  firstSeen: integer("first_seen").notNull(),
  lastSeen: integer("last_seen").notNull(),
  timesSeen: integer("times_seen").notNull().default(1),
});

export const sightings = sqliteTable("sightings", {
  id: id(),
  objectId: integer("object_id").notNull().references(() => objects.id, { onDelete: "cascade" }),
  scanId: integer("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
  bboxJson: text("bbox_json").notNull(),
  maskRef: text("mask_ref"),
  ocrText: text("ocr_text").notNull().default(""),
  matchConfidence: real("match_confidence").notNull(),
});

export const events = sqliteTable("events", {
  id: id(),
  objectId: integer("object_id").notNull().references(() => objects.id, { onDelete: "cascade" }),
  type: text({ enum: ["appeared", "moved", "vanished", "near"] }).notNull(),
  detailsJson: text("details_json").notNull().default("{}"),
  createdAt: now(),
});

export const memories = sqliteTable("memories", {
  id: id(),
  objectId: integer("object_id").notNull().references(() => objects.id, { onDelete: "cascade" }),
  type: text({ enum: ["said", "heard", "event"] }).notNull(),
  content: text().notNull(),
  createdAt: now(),
});

export const relationships = sqliteTable("relationships", {
  id: id(),
  objectA: integer("object_a").notNull().references(() => objects.id, { onDelete: "cascade" }),
  objectB: integer("object_b").notNull().references(() => objects.id, { onDelete: "cascade" }),
  kind: text({ enum: ["friend", "rival", "crush", "ignore"] }).notNull(),
  strength: integer().notNull().default(1),
});

export const userMessages = sqliteTable("user_messages", {
  id: id(),
  objectId: integer("object_id").notNull().references(() => objects.id, { onDelete: "cascade" }),
  content: text().notNull(),
  reply: text().notNull(),
  createdAt: now(),
});

export const moodHistory = sqliteTable("mood_history", {
  id: id(),
  objectId: integer("object_id").notNull().references(() => objects.id, { onDelete: "cascade" }),
  mood: integer().notNull(),
  createdAt: now(),
});

export const llmCalls = sqliteTable("llm_calls", {
  id: id(),
  provider: text().notNull(),
  model: text().notNull(),
  latencyMs: real("latency_ms").notNull(),
  ok: integer({ mode: "boolean" }).notNull(),
  error: text(),
  createdAt: now(),
});

export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});
