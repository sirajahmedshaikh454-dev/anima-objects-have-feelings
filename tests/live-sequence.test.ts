import { describe, expect, it } from "vitest";
import { buildContext } from "@/lib/personality/context";
import { clearTurnCache, runTurn } from "@/lib/personality/engine";
import { mockProvider } from "@/lib/personality/providers";
import { processScan, resetSession } from "@/lib/realtime/pipeline";
import { frame, tempDb } from "./helpers";

// A "camera" filming a desk: mug + pen + phone, then the mug is moved, then the phone leaves.
const MUG = { name: "mug", box: [100, 500, 220, 680] as [number, number, number, number] };
const MUG_MOVED = { name: "mug", box: [330, 500, 450, 680] as [number, number, number, number] };
const PEN = { name: "pen", box: [620, 620, 780, 670] as [number, number, number, number] };
const PHONE = { name: "phone", box: [800, 200, 950, 500] as [number, number, number, number] };
const CAMERA = [
  frame([MUG, PEN, PHONE]),
  frame([MUG_MOVED, PEN, PHONE]),
  frame([MUG_MOVED, PEN]), // phone missing once: debounced
  frame([MUG_MOVED, PEN]), // phone missing twice: vanished
];

describe("live mode simulated camera (Phase 4 EXIT)", () => {
  it("fires appear → move → vanish and the objects react to each", async () => {
    clearTurnCache();
    const db = tempDb();
    resetSession("cam");
    const reactions: { events: string[]; lines: { id: string; text: string }[] }[] = [];
    let names = new Map<number, string>();

    for (const f of CAMERA) {
      const scan = processScan(db, { analysis: f, mode: "live", sessionId: "cam" });
      names = new Map([...names, ...scan.objects.map((o) => [o.objectId, o.name] as const)]);
      if (!scan.events.length) {
        reactions.push({ events: [], lines: [] });
        continue;
      }
      const ctx = buildContext(db, { kind: "scene", presentIds: scan.objects.map((o) => o.objectId), events: scan.events, maxLines: 3 });
      const turn = await runTurn(ctx, {}, { providers: [mockProvider(0)], db });
      reactions.push({ events: scan.events.map((e) => `${e.type}:${names.get(e.objectId)}`), lines: turn.lines.map((l) => ({ id: l.object_id, text: l.text })) });
    }

    const [mugId, , phoneId] = [...names.keys()];
    // Frame 1: everyone appears and greets.
    expect(reactions[0].events.filter((e) => e.startsWith("appeared"))).toHaveLength(3);
    expect(reactions[0].lines.length).toBeGreaterThan(0);
    // Frame 2: only the mug moved, and the mug itself reacts.
    expect(reactions[1].events).toEqual([`moved:${names.get(mugId)}`]);
    expect(reactions[1].lines[0].id).toBe(String(mugId));
    // Frame 3: one missed frame is not a vanish.
    expect(reactions[2].events).toEqual([]);
    // Frame 4: the phone vanished; someone else gossips about it.
    expect(reactions[3].events).toEqual([`vanished:${names.get(phoneId)}`]);
    expect(reactions[3].lines[0].id).not.toBe(String(phoneId));
    expect(reactions[3].lines[0].text).toContain(names.get(phoneId)!);
  });

  it("an object mentions an earlier event in its memories (Phase 6 EXIT)", () => {
    const db = tempDb();
    resetSession("mem");
    processScan(db, { analysis: CAMERA[0], mode: "live", sessionId: "mem" });
    const s2 = processScan(db, { analysis: CAMERA[1], mode: "live", sessionId: "mem" });
    const mug = s2.objects.find((o) => o.label === "mug")!;
    const ctx = buildContext(db, { kind: "reply", presentIds: [mug.objectId], events: [], userMessage: { objectId: mug.objectId, text: "Hi!" }, maxLines: 1 });
    expect(ctx.objects[0].memories).toContain("Got moved by the human without asking.");
  });
});
