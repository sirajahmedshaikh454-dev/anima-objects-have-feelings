import type { Box, Detection, MirageRaw, Relation, Scene } from "./types";

export const MAX_OBJECTS = 8;
const MIN_SCORE = 0.3;
// Body parts and backgrounds make boring characters.
const SKIP = new Set(["ear", "eye", "nose", "mouth", "grass", "road", "sky", "floor", "tiled floor", "ceiling", "wall"]);

const toBox = ([x1, y1, x2, y2]: [number, number, number, number]): Box => ({
  x: x1 / 1000,
  y: y1 / 1000,
  w: Math.max(0, x2 - x1) / 1000,
  h: Math.max(0, y2 - y1) / 1000,
});

export const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export const distance = (a: Box, b: Box) => {
  const ca = center(a), cb = center(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
};

const contains = (b: Box, p: { x: number; y: number }) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** Spatial relations from box positions, used for pairs Mirage said nothing about. */
export function deriveRelations(dets: Detection[]): Relation[] {
  const out: Relation[] = [];
  for (const a of dets)
    for (const b of dets) {
      if (a.index >= b.index) continue;
      const predicate = distance(a.box, b.box) < 0.25 ? "next_to" : center(a.box).x < center(b.box).x ? "left_of" : "right_of";
      out.push({ a: a.index, b: b.index, predicate, source: "derived" });
    }
  return out;
}

export function normalizeScene(raw: MirageRaw, meta: { width: number; height: number; latencyMs: number }): Scene {
  const kept = raw.objects
    .filter((o) => o.score >= MIN_SCORE && !SKIP.has(o.name.toLowerCase()))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OBJECTS);

  const detections: Detection[] = kept.map((o, index) => {
    const pts = o.mask && o.mask.length >= 6 ? o.mask : null;
    return {
      index,
      label: o.name.toLowerCase(),
      score: o.score,
      box: toBox(o.bbox),
      mask: pts ? Array.from({ length: Math.floor(pts.length / 2) }, (_, i): [number, number] => [pts[i * 2] / 1000, pts[i * 2 + 1] / 1000]) : null,
      color: o.description?.color ?? null,
      position: o.position ?? null,
      ocrText: "",
    };
  });

  // OCR text goes to the smallest kept object containing the text's centre.
  for (const t of raw.text) {
    const c = center(toBox(t.bbox));
    const owner = detections.filter((d) => contains(d.box, c)).sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0];
    if (owner) owner.ocrText = `${owner.ocrText} ${t.string}`.trim();
  }

  // Mirage relations use group ids; map each group to its highest-scoring kept detection.
  const groupToIndex = new Map<number, number>();
  kept.forEach((o, i) => {
    if (!groupToIndex.has(o.id)) groupToIndex.set(o.id, i);
  });
  const relations: Relation[] = [];
  const seen = new Set<string>();
  for (const r of raw.relations) {
    const a = groupToIndex.get(r.subject), b = groupToIndex.get(r.object);
    if (a === undefined || b === undefined || a === b || seen.has(pairKey(a, b))) continue;
    relations.push({ a, b, predicate: r.predicate, source: "mirage" });
    seen.add(pairKey(a, b));
  }
  for (const r of deriveRelations(detections)) if (!seen.has(pairKey(r.a, r.b))) relations.push(r);

  return { setting: raw.scene.setting ?? null, detections, relations, ...meta };
}
