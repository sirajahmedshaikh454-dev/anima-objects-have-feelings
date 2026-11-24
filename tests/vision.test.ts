import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeScene } from "@/lib/vision/normalize";
import { MirageRawSchema } from "@/lib/vision/types";

const dir = "docs/mirage-samples";
const samples = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ f, ...(JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as { raw: unknown; latency_ms: number }) }));

describe("Mirage schema (from real samples)", () => {
  it.each(samples.map((s) => [s.f, s] as const))("%s parses and normalizes", (_f, s) => {
    const scene = normalizeScene(MirageRawSchema.parse(s.raw), { width: 640, height: 480, latencyMs: s.latency_ms });
    expect(scene.detections.length).toBeGreaterThan(0);
    expect(scene.detections.length).toBeLessThanOrEqual(8);
    for (const d of scene.detections) {
      expect(d.box.x).toBeGreaterThanOrEqual(0);
      expect(d.box.x + d.box.w).toBeLessThanOrEqual(1.0001);
      expect(d.box.y + d.box.h).toBeLessThanOrEqual(1.0001);
    }
    expect(new Set(scene.detections.map((d) => d.index)).size).toBe(scene.detections.length);
  });

  it("assigns OCR text to the containing object", () => {
    const raw = MirageRawSchema.parse(samples.find((s) => s.f.includes("724"))!.raw);
    const scene = normalizeScene(raw, { width: 640, height: 480, latencyMs: 0 });
    expect(scene.detections.some((d) => d.ocrText.length > 0)).toBe(true);
  });

  it("maps group-id relations to kept detections and derives the rest", () => {
    const raw = MirageRawSchema.parse(samples.find((s) => s.f.includes("39769"))!.raw);
    const scene = normalizeScene(raw, { width: 640, height: 480, latencyMs: 0 });
    expect(scene.relations.some((r) => r.source === "mirage")).toBe(true);
    const n = scene.detections.length;
    expect(scene.relations.length).toBe((n * (n - 1)) / 2);
  });
});
