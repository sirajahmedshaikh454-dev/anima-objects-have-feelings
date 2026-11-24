import { distance } from "@/lib/vision/normalize";
import type { Box } from "@/lib/vision/types";

export type ChangeType = "appeared" | "moved" | "vanished" | "near";
export type ChangeEvent = { type: ChangeType; objectId: number; otherId?: number; from?: Box; to?: Box };

export type SceneState = {
  tracked: Map<number, { box: Box; missed: number }>;
  nearPairs: Set<string>;
};

export const emptyState = (): SceneState => ({ tracked: new Map(), nearPairs: new Set() });

export const CHANGE_DEFAULTS = { moveThreshold: 0.08, vanishAfter: 2, nearDistance: 0.22 };

const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/**
 * Compares the objects seen in this frame with the previous scene.
 * Vanishing needs `vanishAfter` missed frames so one bad detection doesn't trigger gossip.
 */
export function detectChanges(
  prev: SceneState,
  current: { objectId: number; box: Box }[],
  opts: Partial<typeof CHANGE_DEFAULTS> = {},
): { events: ChangeEvent[]; next: SceneState } {
  const o = { ...CHANGE_DEFAULTS, ...opts };
  const events: ChangeEvent[] = [];
  const next = emptyState();
  const seen = new Set(current.map((c) => c.objectId));

  for (const c of current) {
    const before = prev.tracked.get(c.objectId);
    if (!before) events.push({ type: "appeared", objectId: c.objectId, to: c.box });
    else if (distance(before.box, c.box) > o.moveThreshold) events.push({ type: "moved", objectId: c.objectId, from: before.box, to: c.box });
    next.tracked.set(c.objectId, { box: c.box, missed: 0 });
  }

  for (const [id, t] of prev.tracked) {
    if (seen.has(id)) continue;
    const missed = t.missed + 1;
    if (missed >= o.vanishAfter) events.push({ type: "vanished", objectId: id, from: t.box });
    else next.tracked.set(id, { box: t.box, missed });
  }

  for (let i = 0; i < current.length; i++)
    for (let j = i + 1; j < current.length; j++) {
      const a = current[i], b = current[j];
      if (distance(a.box, b.box) >= o.nearDistance) continue;
      const k = key(a.objectId, b.objectId);
      next.nearPairs.add(k);
      if (!prev.nearPairs.has(k)) events.push({ type: "near", objectId: a.objectId, otherId: b.objectId });
    }

  return { events, next };
}
