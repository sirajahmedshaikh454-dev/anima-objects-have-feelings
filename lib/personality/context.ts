import { desc, eq, inArray, or } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema as s } from "@/lib/db";
import { distance } from "@/lib/vision/normalize";
import type { Box } from "@/lib/vision/types";
import type { TurnContext, TurnEvent, TurnObject } from "./types";

export function ago(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Gathers what each object knows: soul, last 5 memories, neighbours, relationships, time since last seen. */
export function buildContext(
  db: Db,
  input: { presentIds: number[]; events: TurnEvent[]; kind: TurnContext["kind"]; setting?: string | null; userMessage?: TurnContext["userMessage"]; maxLines: number; now?: number },
): TurnContext {
  const now = input.now ?? Date.now();
  const ids = [...new Set([...input.presentIds, ...input.events.flatMap((e) => [e.objectId, e.otherId ?? e.objectId])])];
  const rows = ids.length ? db.select().from(s.objects).where(inArray(s.objects.id, ids)).all() : [];
  const present = new Set(input.presentIds);
  const boxes = new Map(rows.map((r) => [r.id, JSON.parse(r.lastBboxJson) as Box]));
  const names = new Map(rows.map((r) => [r.id, r.name]));
  const rels = ids.length
    ? db.select().from(s.relationships).where(or(inArray(s.relationships.objectA, ids), inArray(s.relationships.objectB, ids))).all()
    : [];

  const objects: TurnObject[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    label: r.label,
    traits: JSON.parse(r.traitsJson),
    mood: r.mood,
    ocr: r.lastOcr,
    lastSeenAgo: ago(now - r.lastSeen),
    present: present.has(r.id),
    memories: db
      .select({ c: s.memories.content })
      .from(s.memories)
      .where(eq(s.memories.objectId, r.id))
      .orderBy(desc(s.memories.id))
      .limit(5)
      .all()
      .map((m) => m.c)
      .reverse(),
    neighbours: rows
      .filter((o) => o.id !== r.id && present.has(o.id) && distance(boxes.get(o.id)!, boxes.get(r.id)!) < 0.3)
      .map((o) => o.name),
    relationships: rels
      .filter((x) => x.objectA === r.id || x.objectB === r.id)
      .map((x) => {
        const other = x.objectA === r.id ? x.objectB : x.objectA;
        return names.has(other) ? `${x.kind} of ${names.get(other)}` : null;
      })
      .filter((x): x is string => !!x),
  }));

  return { kind: input.kind, setting: input.setting ?? null, objects, events: input.events, userMessage: input.userMessage, maxLines: input.maxLines };
}
