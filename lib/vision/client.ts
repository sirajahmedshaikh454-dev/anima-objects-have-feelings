import { readFile } from "node:fs/promises";
import path from "node:path";
import { AnalyzeResponseSchema, type AnalyzeResponse } from "./types";

export const MIRAGE_URL = process.env.MIRAGE_URL ?? "http://127.0.0.1:8765";

export class VisionUnavailableError extends Error {}

/** Sends an image to the local Mirage service. The image never leaves this machine. */
export async function analyzeImage(bytes: Uint8Array, mime = "image/jpeg"): Promise<AnalyzeResponse> {
  // ANIMA_FAKE_VISION=1 replays a real recorded Mirage output (e2e tests and CI have no model).
  if (process.env.ANIMA_FAKE_VISION === "1") {
    const file = path.join(process.cwd(), "docs", "mirage-samples", process.env.ANIMA_FAKE_SAMPLE ?? "coco_000000039769.json");
    const sample = JSON.parse(await readFile(file, "utf8"));
    return AnalyzeResponseSchema.parse({ width: 640, height: 480, latency_ms: sample.latency_ms, raw: sample.raw });
  }
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(bytes)], { type: mime }), "frame");
  let res: Response;
  try {
    res = await fetch(`${MIRAGE_URL}/analyze`, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new VisionUnavailableError(`Mirage service not reachable at ${MIRAGE_URL} (${(e as Error).message})`);
  }
  if (res.status === 503) throw new VisionUnavailableError("Mirage model is still loading");
  if (!res.ok) throw new Error(`Mirage /analyze failed (${res.status}): ${await res.text()}`);
  return AnalyzeResponseSchema.parse(await res.json());
}

export async function visionHealth(): Promise<{ ok: boolean; detail: string }> {
  if (process.env.ANIMA_FAKE_VISION === "1") return { ok: true, detail: "fake vision (recorded samples)" };
  try {
    const r = await fetch(`${MIRAGE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    const j = (await r.json()) as { model_loaded: boolean; error: string | null };
    return { ok: j.model_loaded, detail: j.model_loaded ? "Mirage loaded" : `Mirage not loaded: ${j.error ?? "loading"}` };
  } catch {
    return { ok: false, detail: `Mirage service not reachable at ${MIRAGE_URL}` };
  }
}
