import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/db/settings";
import { buildContext } from "@/lib/personality/context";
import { runTurn } from "@/lib/personality/engine";
import { remember } from "@/lib/realtime/pipeline";
import { sseResponse } from "@/lib/realtime/sse";
import { speechLimiter } from "@/lib/realtime/speechLimiter";

const Body = z.object({
  sessionId: z.string().max(64),
  presentIds: z.array(z.number().int()).max(20),
  events: z.array(z.object({ type: z.enum(["appeared", "moved", "vanished", "near"]), objectId: z.number().int(), otherId: z.number().int().optional() })).max(50),
  setting: z.string().max(100).nullable().optional(),
});

/** One conversational turn for the current scene, streamed as SSE: provider → delta* → line* → done. */
export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Bad request", issues: body.error.issues }, { status: 400 });
  const { sessionId, presentIds, events, setting } = body.data;
  if (!presentIds.length) return Response.json({ error: "Nobody here to talk." }, { status: 400 });

  const wait = speechLimiter.wait(sessionId);
  if (wait > 0) return Response.json({ error: "Objects are catching their breath.", retryAfterMs: wait }, { status: 429 });
  speechLimiter.spoke(sessionId, 1); // hold the slot while generating

  const db = getDb();
  const ctx = buildContext(db, { kind: "scene", presentIds, events, setting, maxLines: getSettings(db).chattiness });

  return sseResponse(async (send) => {
    const result = await runTurn(
      ctx,
      {
        onProvider: (p) => send("provider", p),
        onDelta: (d) => send("delta", d),
        onReset: (reason) => send("reset", { reason }),
      },
      { db },
    );
    speechLimiter.spoke(sessionId, result.lines.length);
    for (const l of result.lines) {
      remember(db, Number(l.object_id), "said", l.text);
      send("line", l);
    }
    send("done", { provider: result.provider, model: result.model });
  });
}
