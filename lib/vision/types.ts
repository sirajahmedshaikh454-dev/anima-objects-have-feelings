import { z } from "zod";

// Shapes taken from real Mirage output in docs/mirage-samples (cactus-compute 4.2.6).
// Coordinates are normalized 0–1000 as [x1, y1, x2, y2]; masks are flat polygons in the same space.
const Bbox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const MirageObjectSchema = z.object({
  id: z.number(), // class-group id: every "chair" shares one id
  name: z.string(),
  bbox: Bbox,
  score: z.number(),
  mask: z.array(z.number()).optional(),
  position: z.string().optional(),
  description: z.record(z.string(), z.string()).optional(),
});

export const MirageRawSchema = z.object({
  scene: z.record(z.string(), z.string()).default({}),
  objects: z.array(MirageObjectSchema).default([]),
  regions: z.array(z.looseObject({ id: z.number(), name: z.string() })).default([]),
  text: z.array(z.object({ string: z.string(), bbox: Bbox, score: z.number() })).default([]),
  relations: z.array(z.object({ subject: z.number(), predicate: z.string(), object: z.number() })).default([]),
  events: z.array(z.object({ actor: z.number(), action: z.string(), target: z.number().optional() })).default([]),
  reasoning: z.string().default(""),
});

export const AnalyzeResponseSchema = z.object({
  width: z.number(),
  height: z.number(),
  latency_ms: z.number(),
  raw: MirageRawSchema,
});

export type MirageObject = z.infer<typeof MirageObjectSchema>;
export type MirageRaw = z.infer<typeof MirageRawSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

/** Box in 0..1 image fractions. */
export type Box = { x: number; y: number; w: number; h: number };

export type Detection = {
  index: number; // unique within one scan
  label: string;
  score: number;
  box: Box;
  mask: [number, number][] | null; // polygon in 0..1, null when Mirage gave none
  color: string | null;
  position: string | null;
  ocrText: string;
};

export type Relation = { a: number; b: number; predicate: string; source: "mirage" | "derived" };

export type Scene = {
  setting: string | null;
  detections: Detection[];
  relations: Relation[];
  latencyMs: number;
  width: number;
  height: number;
};
