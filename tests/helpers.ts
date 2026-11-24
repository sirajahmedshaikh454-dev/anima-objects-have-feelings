import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDb } from "@/lib/db";
import type { AnalyzeResponse } from "@/lib/vision/types";

export const tempDb = () => openDb(path.join(mkdtempSync(path.join(tmpdir(), "anima-")), "test.db"));

type Obj = { name: string; box: [number, number, number, number]; score?: number; group?: number };

/** Builds a Mirage-shaped analysis (0–1000 coords), like one frame from a camera. */
export function frame(objs: Obj[], text: { string: string; bbox: [number, number, number, number] }[] = []): AnalyzeResponse {
  return {
    width: 640,
    height: 480,
    latency_ms: 100,
    raw: {
      scene: { setting: "desk" },
      objects: objs.map((o, i) => ({ id: o.group ?? i + 1, name: o.name, bbox: o.box, score: o.score ?? 0.8 })),
      regions: [],
      text: text.map((t) => ({ ...t, score: 0.9 })),
      relations: [],
      events: [],
      reasoning: "",
    },
  };
}
