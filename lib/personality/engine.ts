import type { Db } from "@/lib/db";
import { schema as s } from "@/lib/db";
import { buildTurnMessages } from "@/lib/prompts/turn";
import { LLM_TIMEOUT_MS, providerConfigs } from "./config";
import { parseTurn, partialLines } from "./output";
import { mockProvider, openAICompatible } from "./providers";
import { hash } from "./soul";
import type { Line, Provider, TurnContext } from "./types";

export type TurnHandlers = {
  onProvider?: (p: { name: string; model: string }) => void;
  onDelta?: (d: { object_id: string; text: string; index: number }) => void;
  onReset?: (reason: string) => void; // a provider failed mid-stream; clear partial text
};

/** Enabled providers in fallback order; mock is always last. */
export const defaultProviders = (): Provider[] => [
  ...providerConfigs().filter((c) => c.enabled).map(openAICompatible),
  mockProvider(),
];

// Identical prompts within 10 minutes reuse the answer (saves free-tier quota).
const g = globalThis as unknown as { __animaCache?: Map<number, { at: number; lines: Line[]; provider: string }> };
const cache = (g.__animaCache ??= new Map());
const CACHE_MS = 10 * 60_000;

async function attempt(p: Provider, ctx: TurnContext, timeoutMs: number, h: TurnHandlers) {
  const controller = new AbortController();
  // Timeout is for the first token; once streaming, allow up to 3x for the rest.
  let timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs);
  let buffer = "";
  const shown: string[] = [];
  try {
    for await (const chunk of p.stream({ messages: buildTurnMessages(ctx), context: ctx, signal: controller.signal })) {
      if (!buffer) {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(new Error("stream stalled")), timeoutMs * 3);
      }
      buffer += chunk;
      partialLines(buffer).forEach((l, index) => {
        if (l.text !== shown[index]) {
          shown[index] = l.text;
          h.onDelta?.({ ...l, index });
        }
      });
    }
  } finally {
    clearTimeout(timer);
  }
  const lines = parseTurn(buffer, ctx);
  if (!lines) throw new Error(`invalid JSON reply: ${buffer.slice(0, 120)}`);
  return lines;
}

/**
 * Runs one conversational turn: each provider gets two tries (429, timeout, error or bad JSON),
 * then the next provider takes over. The mock provider never fails, so a turn always completes.
 */
export async function runTurn(
  ctx: TurnContext,
  h: TurnHandlers = {},
  opts: { providers?: Provider[]; db?: Db; timeoutMs?: number } = {},
): Promise<{ provider: string; model: string; lines: Line[] }> {
  const providers = opts.providers ?? defaultProviders();
  const key = hash(JSON.stringify(buildTurnMessages(ctx)));
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    h.onProvider?.({ name: `${hit.provider} (cached)`, model: "" });
    hit.lines.forEach((l, index) => h.onDelta?.({ object_id: l.object_id, text: l.text, index }));
    return { provider: hit.provider, model: "cache", lines: hit.lines };
  }

  const errors: string[] = [];
  for (const p of providers) {
    h.onProvider?.({ name: p.name, model: p.model });
    for (let tryNo = 1; tryNo <= 2; tryNo++) {
      const t0 = performance.now();
      try {
        const lines = await attempt(p, ctx, opts.timeoutMs ?? LLM_TIMEOUT_MS, h);
        opts.db?.insert(s.llmCalls).values({ provider: p.name, model: p.model, latencyMs: performance.now() - t0, ok: true }).run();
        cache.set(key, { at: Date.now(), lines, provider: p.name });
        if (cache.size > 200) cache.delete(cache.keys().next().value!);
        return { provider: p.name, model: p.model, lines };
      } catch (e) {
        const msg = (e as Error).message;
        errors.push(`${p.name}#${tryNo}: ${msg}`);
        opts.db?.insert(s.llmCalls).values({ provider: p.name, model: p.model, latencyMs: performance.now() - t0, ok: false, error: msg.slice(0, 500) }).run();
        h.onReset?.(`${p.name} failed: ${msg}`);
      }
    }
  }
  throw new Error(`all providers failed: ${errors.join(" | ")}`);
}

export const clearTurnCache = () => cache.clear();
