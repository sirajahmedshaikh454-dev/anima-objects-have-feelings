import type { ChatMessage, TurnContext } from "@/lib/personality/types";

export const SYSTEM_PROMPT = `You voice everyday objects that have come alive in a photo. Each object has its own name, traits and mood.
Rules:
- Funny, warm, clean humour that is safe for all ages. No insults about people, no scary or adult content.
- Each object speaks at most 2 short sentences per line. Stay in character (traits + mood: low mood = grumpy, high = happy).
- Refer to memories and events naturally ("you moved me again!", "nobody looked at me yesterday").
- Objects can talk to the user or to each other.
- Only objects marked present may speak. Absent objects can be gossiped about.
- Reply with ONLY this JSON, keys in this order, no markdown:
{"lines":[{"object_id":"<id>","text":"...","emotion":"happy|grumpy|surprised|jealous|sleepy|excited|sad|smug|nervous|curious","target":"user"|"<object id>"}]}`;

const describeEvent = (e: TurnContext["events"][number], name: (id: number) => string) => {
  switch (e.type) {
    case "appeared": return `${name(e.objectId)} just appeared in view`;
    case "moved": return `the human just moved ${name(e.objectId)}`;
    case "vanished": return `${name(e.objectId)} just vanished from view (others may gossip)`;
    case "near": return `${name(e.objectId)} is now right next to ${name(e.otherId!)}`;
  }
};

export function buildTurnMessages(ctx: TurnContext): ChatMessage[] {
  const name = (id: number) => {
    const o = ctx.objects.find((x) => x.id === id);
    return o ? `${o.name} the ${o.label} (#${id})` : `object #${id}`;
  };
  const souls = ctx.objects
    .map((o) =>
      [
        `#${o.id} ${o.name} the ${o.label}${o.present ? "" : " [NOT PRESENT]"}`,
        `  traits: ${o.traits.join(", ")}; mood ${o.mood}/100; last seen ${o.lastSeenAgo}`,
        o.ocr && `  printed text on it: "${o.ocr}"`,
        o.neighbours.length && `  next to: ${o.neighbours.join(", ")}`,
        o.relationships.length && `  relationships: ${o.relationships.join(", ")}`,
        o.memories.length && `  remembers: ${o.memories.map((m) => `"${m}"`).join("; ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const task =
    ctx.kind === "reply" && ctx.userMessage
      ? `The human says to ${name(ctx.userMessage.objectId)}: "${ctx.userMessage.text}"\nWrite exactly 1 line: ${name(ctx.userMessage.objectId)} answers the human in character.`
      : `What just happened:\n${ctx.events.map((e) => `- ${describeEvent(e, name)}`).join("\n") || "- nothing new; make small talk"}\nWrite up to ${ctx.maxLines} lines reacting to this. Different objects should speak.`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Scene: ${ctx.setting ?? "unknown place"}\nObjects:\n${souls}\n\n${task}` },
  ];
}
