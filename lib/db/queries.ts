import { asc, desc, eq, inArray, or } from "drizzle-orm";
import type { Db } from "./index";
import { schema as s } from "./index";

export type SoulCard = NonNullable<ReturnType<typeof getSoulCard>>;

/** Everything the Soul Card shows for one object. */
export function getSoulCard(db: Db, id: number) {
  const o = db.select().from(s.objects).where(eq(s.objects.id, id)).get();
  if (!o) return null;
  const rels = db.select().from(s.relationships).where(or(eq(s.relationships.objectA, id), eq(s.relationships.objectB, id))).all();
  const otherIds = rels.map((r) => (r.objectA === id ? r.objectB : r.objectA));
  const others = otherIds.length ? db.select({ id: s.objects.id, name: s.objects.name, label: s.objects.label }).from(s.objects).where(inArray(s.objects.id, otherIds)).all() : [];
  return {
    id: o.id,
    name: o.name,
    label: o.label,
    traits: JSON.parse(o.traitsJson) as string[],
    voice: JSON.parse(o.voiceJson) as { pitch: number; rate: number },
    mood: o.mood,
    firstSeen: o.firstSeen,
    lastSeen: o.lastSeen,
    timesSeen: o.timesSeen,
    moodHistory: db.select({ mood: s.moodHistory.mood, at: s.moodHistory.createdAt }).from(s.moodHistory).where(eq(s.moodHistory.objectId, id)).orderBy(asc(s.moodHistory.id)).all().slice(-60),
    memories: db.select().from(s.memories).where(eq(s.memories.objectId, id)).orderBy(desc(s.memories.id)).limit(30).all(),
    relationships: rels.map((r) => {
      const other = others.find((x) => x.id === (r.objectA === id ? r.objectB : r.objectA));
      return { kind: r.kind, strength: r.strength, other };
    }),
  };
}

/** Diary: every object with everything it said, newest first. */
export function getDiary(db: Db) {
  const objs = db.select().from(s.objects).orderBy(desc(s.objects.lastSeen)).all();
  const mems = db.select().from(s.memories).orderBy(desc(s.memories.id)).limit(2000).all();
  return objs.map((o) => ({
    id: o.id,
    name: o.name,
    label: o.label,
    mood: o.mood,
    lastSeen: o.lastSeen,
    entries: mems.filter((m) => m.objectId === o.id),
  }));
}

export function resetAll(db: Db) {
  for (const t of [s.memories, s.userMessages, s.moodHistory, s.events, s.sightings, s.relationships, s.objects, s.scans, s.llmCalls]) db.delete(t).run();
}
