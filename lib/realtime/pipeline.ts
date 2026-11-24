import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "@/lib/db";
import { schema as s } from "@/lib/db";
import { createSoul, hash, type Voice } from "@/lib/personality/soul";
import { normalizeScene } from "@/lib/vision/normalize";
import type { AnalyzeResponse, Box } from "@/lib/vision/types";
import { detectChanges, emptyState, type ChangeEvent, type SceneState } from "./changes";
import { matchDetections, type KnownObject } from "./matcher";

export const IMAGES_DIR = process.env.ANIMA_IMAGES_DIR ?? path.join(process.cwd(), "data", "images");
const DAY = 24 * 60 * 60 * 1000;

export type SceneObject = {
  objectId: number;
  name: string;
  label: string;
  traits: string[];
  voice: Voice;
  mood: number;
  box: Box;
  mask: [number, number][] | null;
  confidence: number;
  needsConfirm: boolean;
  isNew: boolean;
};

export type ScanResult = {
  scanId: number;
  setting: string | null;
  latencyMs: number;
  objects: SceneObject[];
  events: ChangeEvent[];
};

// shortcut: per-session scene state lives in process memory (single local server); move to the DB if this ever runs multi-process.
const g = globalThis as unknown as { __animaScenes?: Map<string, SceneState> };
const scenes = (g.__animaScenes ??= new Map<string, SceneState>());
export const resetSession = (sessionId: string) => scenes.delete(sessionId);

/** A Db or a transaction on it. */
type Q = Pick<Db, "insert" | "update" | "select">;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function setMood(db: Q, objectId: number, mood: number) {
  db.update(s.objects).set({ mood }).where(eq(s.objects.id, objectId)).run();
  db.insert(s.moodHistory).values({ objectId, mood }).run();
}

export function remember(db: Q, objectId: number, type: "said" | "heard" | "event", content: string) {
  db.insert(s.memories).values({ objectId, type, content }).run();
}

function relationshipKind(a: number, b: number) {
  const kinds = ["friend", "rival", "crush", "friend", "rival"] as const;
  return kinds[hash(`${Math.min(a, b)}:${Math.max(a, b)}`) % kinds.length];
}

/** Deletes live-mode frames older than 24 h (database row is kept, image file goes). */
export function pruneLiveFrames(db: Db, now = Date.now()) {
  const old = db
    .select({ id: s.scans.id, imagePath: s.scans.imagePath })
    .from(s.scans)
    .where(and(eq(s.scans.mode, "live"), isNotNull(s.scans.imagePath), lt(s.scans.createdAt, now - DAY)))
    .all();
  for (const o of old) {
    try {
      unlinkSync(o.imagePath!);
    } catch {
      /* already gone */
    }
    db.update(s.scans).set({ imagePath: null }).where(eq(s.scans.id, o.id)).run();
  }
  return old.length;
}

export function processScan(
  db: Db,
  input: { analysis: AnalyzeResponse; mode: "live" | "upload"; sessionId: string; image?: Uint8Array; now?: number },
): ScanResult {
  const now = input.now ?? Date.now();
  const { analysis, mode, sessionId } = input;
  const scene = normalizeScene(analysis.raw, { width: analysis.width, height: analysis.height, latencyMs: analysis.latency_ms });

  return db.transaction((tx) => {
    const scan = tx
      .insert(s.scans)
      .values({ mode, rawMirageJson: JSON.stringify(analysis.raw), latencyMs: analysis.latency_ms, createdAt: now })
      .returning({ id: s.scans.id })
      .get();

    if (input.image) {
      mkdirSync(IMAGES_DIR, { recursive: true });
      const file = path.join(IMAGES_DIR, `${scan.id}-${mode}.jpg`);
      writeFileSync(file, input.image);
      tx.update(s.scans).set({ imagePath: file }).where(eq(s.scans.id, scan.id)).run();
    }

    const labels = [...new Set(scene.detections.map((d) => d.label))];
    const knownRows = labels.length ? tx.select().from(s.objects).where(inArray(s.objects.label, labels)).all() : [];
    const known: KnownObject[] = knownRows.map((r) => ({ id: r.id, label: r.label, box: JSON.parse(r.lastBboxJson), ocr: r.lastOcr }));
    const byId = new Map(knownRows.map((r) => [r.id, r]));

    const objects: SceneObject[] = [];
    for (const m of matchDetections(scene.detections, known)) {
      const d = m.det;
      let row = m.objectId !== null ? byId.get(m.objectId) : undefined;
      let isNew = false;
      if (row) {
        const daysAway = Math.floor((now - row.lastSeen) / DAY);
        let mood = row.mood;
        if (daysAway >= 1) {
          mood -= Math.min(40, daysAway * 10); // ignored → grumpy
          remember(tx, row.id, "event", `Was ignored for ${daysAway} day${daysAway > 1 ? "s" : ""}.`);
        }
        mood = clamp(mood + 2); // being seen is nice
        tx.update(s.objects)
          .set({ lastSeen: now, timesSeen: row.timesSeen + 1, lastBboxJson: JSON.stringify(d.box), lastOcr: d.ocrText || row.lastOcr })
          .where(eq(s.objects.id, row.id))
          .run();
        if (mood !== row.mood) setMood(tx, row.id, mood);
        row = { ...row, mood };
      } else {
        const soul = createSoul({ label: d.label, ocrText: d.ocrText, color: d.color, seed: randomUUID() });
        row = tx
          .insert(s.objects)
          .values({
            label: d.label,
            name: soul.name,
            traitsJson: JSON.stringify(soul.traits),
            voiceJson: JSON.stringify(soul.voice),
            mood: 60,
            lastBboxJson: JSON.stringify(d.box),
            lastOcr: d.ocrText,
            firstSeen: now,
            lastSeen: now,
          })
          .returning()
          .get();
        tx.insert(s.moodHistory).values({ objectId: row.id, mood: row.mood }).run();
        isNew = true;
      }
      tx.insert(s.sightings)
        .values({ objectId: row.id, scanId: scan.id, bboxJson: JSON.stringify(d.box), ocrText: d.ocrText, matchConfidence: m.confidence })
        .run();
      objects.push({
        objectId: row.id,
        name: row.name,
        label: row.label,
        traits: JSON.parse(row.traitsJson),
        voice: JSON.parse(row.voiceJson),
        mood: row.mood,
        box: d.box,
        mask: d.mask,
        confidence: m.confidence,
        needsConfirm: m.needsConfirm,
        isNew,
      });
    }

    // Uploads are one-off photos: compare against an empty scene so everything "appears".
    const prev = mode === "live" ? (scenes.get(sessionId) ?? emptyState()) : emptyState();
    const { events, next } = detectChanges(prev, objects.map((o) => ({ objectId: o.objectId, box: o.box })), mode === "live" ? {} : { vanishAfter: 1 });
    if (mode === "live") scenes.set(sessionId, next);

    for (const e of events) {
      tx.insert(s.events).values({ objectId: e.objectId, type: e.type, detailsJson: JSON.stringify(e), createdAt: now }).run();
      if (e.type === "moved") {
        const o = objects.find((x) => x.objectId === e.objectId);
        if (o) {
          o.mood = clamp(o.mood - 4);
          setMood(tx, o.objectId, o.mood);
        }
        remember(tx, e.objectId, "event", "Got moved by the human without asking.");
      }
      if (e.type === "vanished") remember(tx, e.objectId, "event", "Disappeared from the scene.");
      if (e.type === "near" && e.otherId !== undefined) {
        const [a, b] = [Math.min(e.objectId, e.otherId), Math.max(e.objectId, e.otherId)];
        const rel = tx
          .select()
          .from(s.relationships)
          .where(and(eq(s.relationships.objectA, a), eq(s.relationships.objectB, b)))
          .get();
        if (rel) tx.update(s.relationships).set({ strength: rel.strength + 1 }).where(eq(s.relationships.id, rel.id)).run();
        else tx.insert(s.relationships).values({ objectA: a, objectB: b, kind: relationshipKind(a, b) }).run();
      }
    }

    return { scanId: scan.id, setting: scene.setting, latencyMs: scene.latencyMs, objects, events };
  });
}
