import { distance } from "@/lib/vision/normalize";
import type { Box, Detection } from "@/lib/vision/types";

export type KnownObject = { id: number; label: string; box: Box; ocr: string };
export type Match = { det: Detection; objectId: number | null; confidence: number; needsConfirm: boolean };

export const HIGH = 0.7;
export const MEDIUM = 0.45;

const words = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter(Boolean));

function ocrSimilarity(a: string, b: string): number | null {
  const A = words(a), B = words(b);
  if (A.size === 0 && B.size === 0) return null;
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / (A.size + B.size - inter);
}

/** Same label is required; then position, size and OCR text decide. Returns 0..1. */
export function matchScore(det: Detection, k: KnownObject): number {
  if (det.label !== k.label) return 0;
  const pos = Math.max(0, 1 - distance(det.box, k.box) / 0.5);
  const areaA = det.box.w * det.box.h, areaB = k.box.w * k.box.h;
  const size = 1 - Math.abs(areaA - areaB) / Math.max(areaA, areaB, 1e-6);
  const ocr = ocrSimilarity(det.ocrText, k.ocr);
  const sim = ocr === null ? 0.7 * pos + 0.3 * size : 0.5 * pos + 0.2 * size + 0.3 * ocr;
  return 0.35 + 0.65 * sim; // a label match alone is weak evidence
}

/** Greedy best-first assignment; each known object is used at most once. */
export function matchDetections(dets: Detection[], known: KnownObject[]): Match[] {
  const pairs = dets.flatMap((d) => known.map((k) => ({ d, k, s: matchScore(d, k) }))).filter((p) => p.s >= MEDIUM);
  pairs.sort((a, b) => b.s - a.s);
  const usedDet = new Set<number>(), usedKnown = new Set<number>();
  const out = new Map<number, Match>();
  for (const p of pairs) {
    if (usedDet.has(p.d.index) || usedKnown.has(p.k.id)) continue;
    usedDet.add(p.d.index);
    usedKnown.add(p.k.id);
    out.set(p.d.index, { det: p.d, objectId: p.k.id, confidence: p.s, needsConfirm: p.s < HIGH });
  }
  return dets.map((d) => out.get(d.index) ?? { det: d, objectId: null, confidence: 1, needsConfirm: false });
}
