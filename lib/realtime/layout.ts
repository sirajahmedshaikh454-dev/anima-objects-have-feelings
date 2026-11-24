export type BubbleIn = { id: number; anchorX: number; anchorY: number; w: number; h: number };
export type BubbleOut = { id: number; x: number; y: number }; // top-left, in the same pixel space

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad: number) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/**
 * FR-09: places each bubble above its anchor (the top-centre of the object's box), then nudges
 * bubbles up/down until none overlap. Greedy, top-down; fine for the ≤ 8 objects we show.
 */
export function layoutBubbles(items: BubbleIn[], bounds: { w: number; h: number }, pad = 6): BubbleOut[] {
  const placed: { id: number; x: number; y: number; w: number; h: number }[] = [];
  const clampX = (x: number, w: number) => Math.max(pad, Math.min(bounds.w - w - pad, x));
  const clampY = (y: number, h: number) => Math.max(pad, Math.min(bounds.h - h - pad, y));
  for (const it of [...items].sort((a, b) => a.anchorY - b.anchorY || a.anchorX - b.anchorX)) {
    const x = clampX(it.anchorX - it.w / 2, it.w);
    const base = clampY(it.anchorY - it.h - 12, it.h);
    // Try positions stepping away from the preferred one, alternating up and down.
    let best = { x, y: base };
    for (let step = 0; step < 60; step++) {
      const dy = (step % 2 ? 1 : -1) * Math.ceil(step / 2) * (it.h / 3);
      const cand = { x, y: clampY(base + dy, it.h), w: it.w, h: it.h };
      if (!placed.some((p) => overlap(cand, p, pad))) {
        best = cand;
        break;
      }
    }
    placed.push({ id: it.id, ...best, w: it.w, h: it.h });
  }
  return items.map((it) => {
    const p = placed.find((q) => q.id === it.id)!;
    return { id: it.id, x: p.x, y: p.y };
  });
}
