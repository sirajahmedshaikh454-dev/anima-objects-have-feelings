import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/lib/db";
import { buildContext } from "@/lib/personality/context";
import { runTurn } from "@/lib/personality/engine";
import { remember } from "@/lib/realtime/pipeline";
import { sseResponse } from "@/lib/realtime/sse";

const Body = z.object({
  objectId: z.number().int(),
  text: z.string().trim().min(1).max(300),
  presentIds: z.array(z.number().int()).max(20).default([]),
});

/** FR-11: the user talks to one object; it answers in character and remembers. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Say something first." }, { status: 400 });
  const { objectId, text, presentIds } = body.data;
  const db = getDb();
  const obj = db.select().from(s.objects).where(eq(s.objects.id, objectId)).get();
  if (!obj) return Response.json({ error: "That object is not known." }, { status: 404 });

  remember(db, objectId, "heard", `The human said: "${text}"`);
  const ctx = buildContext(db, {
    kind: "reply",
    presentIds: [...new Set([objectId, ...presentIds])],
    events: [],
    userMessage: { objectId, text },
    maxLines: 1,
  });
  ctx.objects = ctx.objects.map((o) => ({ ...o, present: o.id === objectId })); // only the addressed object answers

  return sseResponse(async (send) => {
    const r = await runTurn(ctx, { onProvider: (p) => send("provider", p), onDelta: (d) => send("delta", d), onReset: (x) => send("reset", { reason: x }) }, { db });
    const line = r.lines[0];
    db.insert(s.userMessages).values({ objectId, content: text, reply: line.text }).run();
    remember(db, objectId, "said", line.text);
    const mood = Math.min(100, obj.mood + 5); // attention makes objects happy
    db.update(s.objects).set({ mood }).where(eq(s.objects.id, objectId)).run();
    db.insert(s.moodHistory).values({ objectId, mood }).run();
    send("line", line);
    send("done", { provider: r.provider, model: r.model, mood });
  });
}
