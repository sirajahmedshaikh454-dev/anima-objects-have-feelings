import { TurnSchema, type Line, type TurnContext } from "./types";

/** Text of each line seen so far in a partially streamed JSON reply, for word-by-word display. */
export function partialLines(buffer: string): { object_id: string; text: string }[] {
  const out: { object_id: string; text: string }[] = [];
  const re = /"object_id"\s*:\s*"?([\w-]+)"?\s*,[^{}]*?"text"\s*:\s*"((?:[^"\\]|\\.)*)/g;
  for (const m of buffer.matchAll(re)) {
    const raw = m[2].replace(/\\$/, ""); // a dangling escape mid-stream
    let text: string;
    try {
      text = JSON.parse(`"${raw}"`);
    } catch {
      text = raw;
    }
    out.push({ object_id: m[1], text });
  }
  return out;
}

const firstTwoSentences = (t: string) => (t.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [t]).slice(0, 2).join("").trim();

/** Parses and validates the final reply; returns null if it is unusable (the engine then retries or falls back). */
export function parseTurn(buffer: string, ctx: TurnContext): Line[] | null {
  const start = buffer.indexOf("{"), end = buffer.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(buffer.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = TurnSchema.safeParse(json);
  if (!parsed.success) return null;
  const speakers = new Set(ctx.objects.filter((o) => o.present).map((o) => String(o.id)));
  const lines = parsed.data.lines
    .filter((l) => speakers.has(l.object_id))
    .slice(0, ctx.maxLines)
    .map((l) => ({ ...l, text: firstTwoSentences(l.text) }));
  return lines.length ? lines : null;
}
