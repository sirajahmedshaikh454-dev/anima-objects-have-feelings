import { getDb } from "@/lib/db";
import { processScan, pruneLiveFrames } from "@/lib/realtime/pipeline";
import { analyzeImage, VisionUnavailableError } from "@/lib/vision/client";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const image = form?.get("image");
  const mode = form?.get("mode") === "live" ? "live" : "upload";
  const sessionId = String(form?.get("sessionId") ?? "default").slice(0, 64);
  if (!(image instanceof Blob) || image.size === 0) return Response.json({ error: "No image received." }, { status: 400 });
  if (image.size > MAX_BYTES) return Response.json({ error: "Image is larger than 15 MB." }, { status: 413 });
  if (!image.type.startsWith("image/")) return Response.json({ error: "That file is not an image." }, { status: 415 });

  const bytes = new Uint8Array(await image.arrayBuffer());
  try {
    const analysis = await analyzeImage(bytes, image.type);
    const db = getDb();
    const result = processScan(db, { analysis, mode, sessionId, image: bytes });
    if (mode === "live") pruneLiveFrames(db);
    console.info(`[scan] ${mode} #${result.scanId}: ${result.objects.length} objects, Mirage ${result.latencyMs} ms`);
    return Response.json(result);
  } catch (e) {
    if (e instanceof VisionUnavailableError)
      return Response.json({ error: "The vision service is not running.", detail: e.message, hint: "Start it with `npm run dev` (or `npm run dev:mirage`) and retry." }, { status: 503 });
    console.error("[scan] failed", e);
    return Response.json({ error: "Scan failed.", detail: (e as Error).message }, { status: 500 });
  }
}
