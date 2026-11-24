import { describe, expect, it } from "vitest";
import { schema as s } from "@/lib/db";
import { createSoul } from "@/lib/personality/soul";
import { detectChanges, emptyState } from "@/lib/realtime/changes";
import { matchDetections, matchScore } from "@/lib/realtime/matcher";
import { processScan, resetSession } from "@/lib/realtime/pipeline";
import { normalizeScene } from "@/lib/vision/normalize";
import { frame, tempDb } from "./helpers";

const MUG: [number, number, number, number] = [100, 500, 200, 650];
const PEN: [number, number, number, number] = [600, 600, 700, 640];
const PHONE: [number, number, number, number] = [400, 300, 520, 520];
const det = (f: ReturnType<typeof frame>) => normalizeScene(f.raw, { width: 640, height: 480, latencyMs: 0 }).detections;

describe("soul generator", () => {
  it("is deterministic per seed and gives 3 distinct traits", () => {
    const a = createSoul({ label: "mug", seed: "x" });
    expect(createSoul({ label: "mug", seed: "x" })).toEqual(a);
    expect(new Set(a.traits).size).toBe(3);
    expect(a.voice.pitch).toBeGreaterThan(0.5);
  });
});

describe("matcher", () => {
  it("requires the same label", () => {
    const [d] = det(frame([{ name: "mug", box: MUG }]));
    expect(matchScore(d, { id: 1, label: "pen", box: d.box, ocr: "" })).toBe(0);
  });

  it("matches the same mug slightly moved with high confidence", () => {
    const [d] = det(frame([{ name: "mug", box: [130, 520, 230, 670] }]));
    const [m] = matchDetections([d], [{ id: 7, label: "mug", box: det(frame([{ name: "mug", box: MUG }]))[0].box, ocr: "" }]);
    expect(m.objectId).toBe(7);
    expect(m.needsConfirm).toBe(false);
  });

  it("asks for confirmation when a mug is far from where it was", () => {
    const [d] = det(frame([{ name: "mug", box: [700, 100, 800, 250] }]));
    const [m] = matchDetections([d], [{ id: 7, label: "mug", box: det(frame([{ name: "mug", box: MUG }]))[0].box, ocr: "" }]);
    expect(m.objectId === null || m.needsConfirm).toBe(true);
  });

  it("uses OCR text to separate two same-label objects", () => {
    const f = frame([{ name: "book", box: [100, 100, 300, 400] }], [{ string: "Dune", bbox: [150, 200, 250, 260] }]);
    const [d] = det(f);
    const ms = matchDetections([d], [
      { id: 1, label: "book", box: d.box, ocr: "Hamlet" },
      { id: 2, label: "book", box: d.box, ocr: "Dune" },
    ]);
    expect(ms[0].objectId).toBe(2);
  });
});

describe("change detector", () => {
  const box = (x: number) => ({ x, y: 0.5, w: 0.1, h: 0.1 });
  it("fires appeared, moved, near and (debounced) vanished", () => {
    let st = emptyState();
    let r = detectChanges(st, [{ objectId: 1, box: box(0.1) }, { objectId: 2, box: box(0.7) }]);
    expect(r.events.map((e) => e.type).sort()).toEqual(["appeared", "appeared"]);
    st = r.next;
    r = detectChanges(st, [{ objectId: 1, box: box(0.6) }, { objectId: 2, box: box(0.7) }]);
    expect(r.events.map((e) => e.type).sort()).toEqual(["moved", "near"]);
    st = r.next;
    r = detectChanges(st, [{ objectId: 1, box: box(0.6) }]);
    expect(r.events).toEqual([]); // one missed frame is not enough
    r = detectChanges(r.next, [{ objectId: 1, box: box(0.6) }]);
    expect(r.events).toEqual([{ type: "vanished", objectId: 2, from: box(0.7) }]);
  });
});

describe("scan pipeline (temp SQLite file)", () => {
  it("recognises the same objects across two photos and logs a moved event", () => {
    const db = tempDb();
    resetSession("t1");
    const a = processScan(db, { analysis: frame([{ name: "mug", box: MUG }, { name: "pen", box: PEN }]), mode: "live", sessionId: "t1" });
    expect(a.objects.every((o) => o.isNew)).toBe(true);
    const b = processScan(db, {
      analysis: frame([{ name: "mug", box: [260, 500, 360, 650] }, { name: "pen", box: PEN }]),
      mode: "live",
      sessionId: "t1",
    });
    expect(b.objects.map((o) => o.objectId).sort()).toEqual(a.objects.map((o) => o.objectId).sort());
    expect(b.objects.some((o) => o.isNew)).toBe(false);
    const mugId = a.objects.find((o) => o.label === "mug")!.objectId;
    expect(b.events).toContainEqual(expect.objectContaining({ type: "moved", objectId: mugId }));
    expect(db.select().from(s.events).all().some((e) => e.type === "moved")).toBe(true);
    expect(db.select().from(s.sightings).all()).toHaveLength(4);
  });

  it("remembers being ignored the next day (grumpier mood + memory)", () => {
    const db = tempDb();
    const t0 = Date.UTC(2026, 0, 1);
    const first = processScan(db, { analysis: frame([{ name: "mug", box: MUG }]), mode: "upload", sessionId: "u", now: t0 });
    const moodBefore = first.objects[0].mood;
    const next = processScan(db, { analysis: frame([{ name: "mug", box: MUG }]), mode: "upload", sessionId: "u", now: t0 + 26 * 3600_000 });
    expect(next.objects[0].objectId).toBe(first.objects[0].objectId);
    expect(next.objects[0].mood).toBeLessThan(moodBefore);
    expect(db.select().from(s.memories).all().map((m) => m.content)).toContain("Was ignored for 1 day.");
  });

  it("stores near pairs as relationships", () => {
    const db = tempDb();
    processScan(db, { analysis: frame([{ name: "mug", box: MUG }, { name: "phone", box: [150, 480, 260, 640] }, { name: "pen", box: PHONE }]), mode: "upload", sessionId: "r" });
    expect(db.select().from(s.relationships).all().length).toBeGreaterThan(0);
  });
});
