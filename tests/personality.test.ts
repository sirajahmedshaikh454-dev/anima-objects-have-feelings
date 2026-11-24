import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { schema as s } from "@/lib/db";
import { providerConfigs } from "@/lib/personality/config";
import { clearTurnCache, runTurn } from "@/lib/personality/engine";
import { MOCK_LINE_COUNT } from "@/lib/personality/mockLines";
import { parseTurn, partialLines } from "@/lib/personality/output";
import { mockProvider, mockTurn, openAICompatible } from "@/lib/personality/providers";
import { HttpError, type Provider, type TurnContext } from "@/lib/personality/types";
import { tempDb } from "./helpers";

const obj = (id: number, name: string, label: string) => ({
  id, name, label, traits: ["dramatic", "sarcastic", "sleepy"], mood: 60, ocr: "", lastSeenAgo: "just now",
  present: true, memories: [], neighbours: [], relationships: [],
});
const ctx = (over: Partial<TurnContext> = {}): TurnContext => ({
  kind: "scene",
  setting: "desk",
  objects: [obj(1, "Mugsy", "mug"), obj(2, "Penelope", "pen"), obj(3, "Ringo", "phone")],
  events: [{ type: "appeared", objectId: 1 }, { type: "appeared", objectId: 2 }, { type: "appeared", objectId: 3 }],
  maxLines: 3,
  ...over,
});

const recorded = readFileSync("tests/fixtures/llm/six-lines.json", "utf8");
/** Replays a recorded LLM reply in small chunks, like a real stream. */
const replay = (text: string, name = "recorded"): Provider => ({
  name,
  model: "fixture",
  async *stream() {
    for (let i = 0; i < text.length; i += 7) yield text.slice(i, i + 7);
  },
});
const failing = (err: () => Error, name = "flaky") => {
  const p: Provider & { calls: number } = {
    name, model: "x", calls: 0,
    async *stream() {
      p.calls++;
      throw err();
    },
  };
  return p;
};

beforeEach(() => clearTurnCache());

describe("output parsing", () => {
  it("extracts partial line text mid-stream", () => {
    const partial = recorded.slice(0, recorded.indexOf("You're half") + 10); // cut inside line 2's text
    const lines = partialLines(partial);
    expect(lines[0]).toEqual({ object_id: "1", text: "Morning, desk crew! Mugsy is fully caffeinated and ready to judge." });
    expect(lines[1].object_id).toBe("2");
    expect(lines[1].text.length).toBeLessThan(50);
  });

  it("validates with zod, drops absent speakers and keeps max 2 sentences", () => {
    const c = ctx({ maxLines: 5, objects: [obj(1, "A", "mug"), { ...obj(2, "B", "pen"), present: false }] });
    const lines = parseTurn('```json\n{"lines":[{"object_id":1,"text":"One. Two! Three?","emotion":"happy","target":"user"},{"object_id":"2","text":"hi"}]}\n```', c);
    expect(lines).toEqual([{ object_id: "1", text: "One. Two!", emotion: "happy", target: "user" }]);
    expect(parseTurn("not json", c)).toBeNull();
    expect(parseTurn('{"lines":[]}', c)).toBeNull();
  });
});

describe("mock engine", () => {
  it("has at least 80 template lines", () => expect(MOCK_LINE_COUNT).toBeGreaterThanOrEqual(80));

  it("reacts to each event type with valid lines", () => {
    const c = ctx({
      maxLines: 4,
      objects: [obj(1, "Mugsy", "mug"), obj(2, "Penelope", "pen"), { ...obj(3, "Ringo", "phone"), present: false }],
      events: [{ type: "moved", objectId: 1 }, { type: "vanished", objectId: 3 }, { type: "near", objectId: 2, otherId: 1 }],
    });
    const turn = mockTurn(c, 42);
    expect(parseTurn(JSON.stringify(turn), c)).not.toBeNull();
    expect(turn.lines.some((l) => l.text.includes("Ringo") || l.text.includes("that one"))).toBe(true); // gossip
    expect(turn.lines.find((l) => l.object_id === "1")).toBeDefined(); // moved mug complains
  });

  it("an ignored object greets the user grumpily", () => {
    const c = ctx({ objects: [{ ...obj(1, "Mugsy", "mug"), memories: ["Was ignored for 1 day."] }], events: [{ type: "appeared", objectId: 1 }] });
    expect(mockTurn(c, 1).lines[0].emotion).toBe("grumpy");
  });
});

describe("engine + fallback chain", () => {
  it("3 objects hold a 6-line conversation, streamed token by token", async () => {
    const deltas: string[] = [];
    const r = await runTurn(ctx({ maxLines: 6 }), { onDelta: (d) => deltas.push(d.text) }, { providers: [replay(recorded)] });
    expect(r.lines).toHaveLength(6);
    expect(new Set(r.lines.map((l) => l.object_id)).size).toBe(3);
    expect(deltas.length).toBeGreaterThan(12); // many partial updates, not one blob
  });

  it("falls back after a 429 (with one retry) and logs both calls", async () => {
    const db = tempDb();
    const groq = failing(() => new HttpError(429, "rate limited"), "groq");
    const resets: string[] = [];
    const r = await runTurn(ctx(), { onReset: (x) => resets.push(x) }, { providers: [groq, replay(recorded, "gemini")], db });
    expect(groq.calls).toBe(2);
    expect(r.provider).toBe("gemini");
    expect(resets).toHaveLength(2);
    const calls = db.select().from(s.llmCalls).all();
    expect(calls.map((c) => [c.provider, c.ok])).toEqual([["groq", false], ["groq", false], ["gemini", true]]);
  });

  it("falls back on timeout and on invalid JSON, ending at the mock engine", async () => {
    const hang: Provider = { name: "hang", model: "x", async *stream({ signal }) { await new Promise((_, rej) => signal.addEventListener("abort", () => rej(signal.reason))); } };
    const r = await runTurn(ctx(), {}, { providers: [hang, replay("I am not JSON", "bad"), mockProvider(0)], timeoutMs: 30 });
    expect(r.provider).toBe("mock");
    expect(r.lines.length).toBeGreaterThan(0);
  });

  it("serves an identical prompt from cache", async () => {
    const p = replay(recorded);
    const first = await runTurn(ctx({ maxLines: 6 }), {}, { providers: [p] });
    const second = await runTurn(ctx({ maxLines: 6 }), {}, { providers: [failing(() => new Error("should not be called"))] });
    expect(second.lines).toEqual(first.lines);
  });
});

describe("OpenAI-compatible provider", () => {
  it("parses SSE deltas", async () => {
    const sse = ['data: {"choices":[{"delta":{"content":"{\\"li"}}]}', 'data: {"choices":[{"delta":{"content":"nes\\":[]}"}}]}', "data: [DONE]", ""].join("\n");
    vi.stubGlobal("fetch", async () => new Response(sse, { status: 200 }));
    const p = openAICompatible({ ...providerConfigs({ GROQ_API_KEY: "k" })[0] });
    let out = "";
    for await (const t of p.stream({ messages: [], context: ctx(), signal: new AbortController().signal })) out += t;
    expect(out).toBe('{"lines":[]}');
    vi.unstubAllGlobals();
  });

  it("raises HttpError on 429", async () => {
    vi.stubGlobal("fetch", async () => new Response("slow down", { status: 429 }));
    const p = openAICompatible({ ...providerConfigs({ GROQ_API_KEY: "k" })[0] });
    await expect(p.stream({ messages: [], context: ctx(), signal: new AbortController().signal }).next()).rejects.toMatchObject({ status: 429 });
    vi.unstubAllGlobals();
  });

  it("enables only providers whose key or URL exists", () => {
    const on = providerConfigs({ GEMINI_API_KEY: "x", OLLAMA_URL: "http://localhost:11434" }).filter((c) => c.enabled).map((c) => c.name);
    expect(on).toEqual(["gemini", "ollama"]);
  });
});

// Optional live smoke test: runs only when a real free key is configured.
const live = providerConfigs().filter((c) => c.enabled);
describe.skipIf(live.length === 0)("live provider smoke test", () => {
  it.each(live.map((c) => [c.name, c] as const))("%s answers with valid JSON", async (_n, c) => {
    const r = await runTurn(ctx(), {}, { providers: [openAICompatible(c)], timeoutMs: 15_000 });
    expect(r.lines.length).toBeGreaterThan(0);
  }, 60_000);
});
