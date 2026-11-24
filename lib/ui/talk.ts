"use client";
import type { Line } from "@/lib/personality/types";
import { readSSE } from "@/lib/realtime/sse";

export type TalkHandlers = {
  onProvider?: (name: string) => void;
  onDelta?: (objectId: number, text: string) => void;
  onLine?: (line: Line) => void;
  onReset?: () => void;
};

/** POSTs to a streaming endpoint (/api/talk or /api/reply). Returns retryAfterMs when rate-limited. */
export async function streamTalk(url: string, body: unknown, h: TalkHandlers): Promise<{ retryAfterMs?: number; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 429) return { retryAfterMs: ((await res.json()) as { retryAfterMs: number }).retryAfterMs };
  if (!res.ok) return { error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${res.status}` };
  let error: string | undefined;
  await readSSE(res, (event, data) => {
    const d = data as Record<string, unknown>;
    if (event === "provider") h.onProvider?.(String(d.name));
    else if (event === "delta") h.onDelta?.(Number(d.object_id), String(d.text));
    else if (event === "line") h.onLine?.(data as Line);
    else if (event === "reset") h.onReset?.();
    else if (event === "error") error = String(d.message);
  });
  return { error };
}
