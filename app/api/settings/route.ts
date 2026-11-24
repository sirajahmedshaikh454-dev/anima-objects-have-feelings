import { rmSync } from "node:fs";
import { desc } from "drizzle-orm";
import { getDb, schema as s } from "@/lib/db";
import { resetAll } from "@/lib/db/queries";
import { getSettings, saveSettings } from "@/lib/db/settings";
import { providerConfigs } from "@/lib/personality/config";
import { IMAGES_DIR } from "@/lib/realtime/pipeline";
import { visionHealth } from "@/lib/vision/client";

/** Settings plus live status of the vision service and each free LLM provider. */
export async function GET() {
  const db = getDb();
  const calls = db.select().from(s.llmCalls).orderBy(desc(s.llmCalls.id)).limit(200).all();
  const providers = [
    ...providerConfigs().map((c) => ({ name: c.name, model: c.model, enabled: c.enabled, signup: c.signup })),
    { name: "mock", model: "templates", enabled: true, signup: "" },
  ].map((p) => {
    const last = calls.find((c) => c.provider === p.name);
    return { ...p, lastOk: last?.ok ?? null, lastError: last?.error ?? null, lastLatencyMs: last ? Math.round(last.latencyMs) : null };
  });
  return Response.json({ settings: getSettings(db), providers, vision: await visionHealth() });
}

export async function PUT(req: Request) {
  try {
    return Response.json({ settings: saveSettings(getDb(), await req.json()) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Settings → "Reset data": forgets every object, memory and stored image. */
export async function DELETE() {
  resetAll(getDb());
  rmSync(IMAGES_DIR, { recursive: true, force: true });
  return Response.json({ ok: true });
}
