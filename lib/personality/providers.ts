import type { ProviderConfig } from "./config";
import { MOCK_LINES } from "./mockLines";
import { hash } from "./soul";
import { HttpError, type Provider, type TurnContext } from "./types";

/** Groq, Gemini, OpenRouter and Ollama all expose an OpenAI-compatible streaming chat endpoint. */
export function openAICompatible(cfg: ProviderConfig): Provider {
  return {
    name: cfg.name,
    model: cfg.model,
    async *stream({ messages, signal }) {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
          ...(cfg.name === "openrouter" ? { "x-title": "ANIMA Objects Have Feelings" } : {}),
        },
        body: JSON.stringify({ model: cfg.model, messages, stream: true, temperature: 0.9, max_tokens: 600, ...cfg.extra }),
      });
      if (!res.ok || !res.body) throw new HttpError(res.status, `${cfg.name} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += value;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          const data = line.trim().replace(/^data:\s*/, "");
          if (!data || data === "[DONE]" || line.trim().startsWith(":")) continue;
          const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string | null } }[] }).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
      }
    },
  };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

/** Builds a valid turn from template lines. Pure, so tests can check it. */
export function mockTurn(ctx: TurnContext, seed = Date.now()): { lines: { object_id: string; text: string; emotion: string; target: string }[] } {
  const present = ctx.objects.filter((o) => o.present);
  const byId = new Map(ctx.objects.map((o) => [o.id, o]));
  const pick = <T,>(arr: T[], salt: string) => arr[hash(`${seed}:${salt}`) % arr.length];
  const say = (group: string, speakerId: number, otherId?: number, target = "user") => {
    const g = pick(MOCK_LINES[group], `${group}:${speakerId}`);
    const sp = byId.get(speakerId)!, other = otherId !== undefined ? byId.get(otherId) : undefined;
    const text = pick(g.lines, `${speakerId}:${otherId}`)
      .replaceAll("{name}", sp.name)
      .replaceAll("{label}", sp.label)
      .replaceAll("{other}", other?.name ?? "that one");
    return { object_id: String(speakerId), text, emotion: g.emotion, target };
  };

  if (!present.length) return { lines: [] };
  if (ctx.kind === "reply" && ctx.userMessage) return { lines: [say("reply", ctx.userMessage.objectId)] };

  const lines: ReturnType<typeof say>[] = [];
  const spoke = new Set<number>();
  const order = { moved: 0, vanished: 1, near: 2, appeared: 3 } as const;
  for (const e of [...ctx.events].sort((a, b) => order[a.type] - order[b.type])) {
    if (lines.length >= ctx.maxLines) break;
    if (e.type === "vanished") {
      const gossip = present.find((o) => !spoke.has(o.id));
      if (gossip) lines.push(say("vanished", gossip.id, e.objectId)), spoke.add(gossip.id);
      continue;
    }
    if (spoke.has(e.objectId) || !byId.get(e.objectId)?.present) continue;
    const ignored = e.type === "appeared" && byId.get(e.objectId)!.memories.some((m) => m.startsWith("Was ignored"));
    lines.push(say(ignored ? "ignored" : e.type, e.objectId, e.otherId, e.type === "near" ? String(e.otherId) : "user"));
    spoke.add(e.objectId);
  }
  if (!lines.length) lines.push(say("idle", pick(present, "idle").id));
  return { lines };
}

/** Offline engine: always works, streams its JSON a word at a time like a real LLM. */
export const mockProvider = (delayMs = 35): Provider => ({
  name: "mock",
  model: "templates",
  async *stream({ context, signal }) {
    for (const chunk of JSON.stringify(mockTurn(context)).split(/(?<= )/)) {
      if (delayMs) await sleep(delayMs, signal);
      yield chunk;
    }
  },
});
