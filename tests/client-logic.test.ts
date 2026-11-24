import { describe, expect, it } from "vitest";
import { FrameGate, frameDifference } from "@/lib/realtime/frameGate";
import { layoutBubbles } from "@/lib/realtime/layout";
import { createSpeechLimiter } from "@/lib/realtime/speechLimiter";

const solid = (v: number, n = 16) => new Uint8ClampedArray(n * 4).map((_, i) => (i % 4 === 3 ? 255 : v));

describe("frame gate", () => {
  it("measures difference", () => {
    expect(frameDifference(solid(10), solid(10))).toBe(0);
    expect(frameDifference(solid(0), solid(100))).toBeCloseTo(100, 0);
  });

  it("sends changed frames only, one request at a time, dropping stale ones", () => {
    const g = new FrameGate(5);
    expect(g.offer(solid(10))).toBe(true);
    expect(g.offer(solid(200))).toBe(false); // in flight: dropped
    g.done();
    expect(g.offer(solid(12))).toBe(false); // unchanged scene
    expect(g.offer(solid(80))).toBe(true);
  });
});

describe("bubble layout", () => {
  it("never overlaps bubbles, even for objects at the same spot", () => {
    const items = [0, 1, 2, 3].map((id) => ({ id, anchorX: 300, anchorY: 300, w: 160, h: 50 }));
    const out = layoutBubbles(items, { w: 800, h: 600 });
    for (const a of out)
      for (const b of out) {
        if (a.id >= b.id) continue;
        const apart = Math.abs(a.x - b.x) >= 160 || Math.abs(a.y - b.y) >= 50;
        expect(apart).toBe(true);
      }
  });

  it("keeps bubbles inside the stage", () => {
    const [p] = layoutBubbles([{ id: 1, anchorX: 5, anchorY: 5, w: 200, h: 60 }], { w: 400, h: 300 });
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
  });
});

describe("speech limiter", () => {
  it("allows one line every 3 s per session", () => {
    const l = createSpeechLimiter(3000);
    expect(l.wait("a", 0)).toBe(0);
    l.spoke("a", 2, 0);
    expect(l.wait("a", 1000)).toBe(5000);
    expect(l.wait("b", 1000)).toBe(0);
    expect(l.wait("a", 6000)).toBe(0);
  });
});
