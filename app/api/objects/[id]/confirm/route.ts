import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { createSoul } from "@/lib/personality/soul";

const Body = z.object({ same: z.boolean(), scanId: z.number().int() });

/**
 * FR-06 answer to "Is this the same mug?". Yes: nothing to change.
 * No: this scan's sighting is split off into a brand-new object with its own soul.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/objects/[id]/confirm">) {
  const id = Number((await ctx.params).id);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Bad request" }, { status: 400 });
  if (body.data.same) return Response.json({ objectId: id });

  const db = getDb();
  const old = db.select().from(s.objects).where(eq(s.objects.id, id)).get();
  const sighting = db.select().from(s.sightings).where(eq(s.sightings.scanId, body.data.scanId)).all().find((x) => x.objectId === id);
  if (!old || !sighting) return Response.json({ error: "Not found" }, { status: 404 });

  const soul = createSoul({ label: old.label, ocrText: sighting.ocrText, seed: randomUUID() });
  const now = Date.now();
  const created = db.transaction((tx) => {
    const row = tx
      .insert(s.objects)
      .values({ label: old.label, name: soul.name, traitsJson: JSON.stringify(soul.traits), voiceJson: JSON.stringify(soul.voice), lastBboxJson: sighting.bboxJson, lastOcr: sighting.ocrText, firstSeen: now, lastSeen: now })
      .returning()
      .get();
    tx.update(s.sightings).set({ objectId: row.id, matchConfidence: 1 }).where(eq(s.sightings.id, sighting.id)).run();
    tx.insert(s.moodHistory).values({ objectId: row.id, mood: row.mood }).run();
    return row;
  });
  return Response.json({ objectId: created.id, name: created.name, traits: soul.traits, voice: soul.voice, mood: created.mood });
}
