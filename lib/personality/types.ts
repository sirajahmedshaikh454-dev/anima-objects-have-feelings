import { z } from "zod";

export type TurnObject = {
  id: number;
  name: string;
  label: string;
  traits: string[];
  mood: number;
  ocr: string;
  lastSeenAgo: string;
  present: boolean;
  memories: string[];
  neighbours: string[];
  relationships: string[];
};

export type TurnEvent = { type: "appeared" | "moved" | "vanished" | "near"; objectId: number; otherId?: number };

export type TurnContext = {
  kind: "scene" | "reply";
  setting: string | null;
  objects: TurnObject[];
  events: TurnEvent[];
  userMessage?: { objectId: number; text: string };
  maxLines: number;
};

// LLMs often echo the prompt's "#1" style for ids; accept 1, "1" and "#1".
const Id = z.union([z.string(), z.number()]).transform((v) => String(v).trim().replace(/^#/, ""));

export const LineSchema = z.object({
  object_id: Id,
  text: z.string().min(1).max(400),
  emotion: z.string().default("neutral"),
  target: Id.default("user"),
});
export const TurnSchema = z.object({ lines: z.array(LineSchema).min(1) });

export type Line = z.infer<typeof LineSchema>;
export type ChatMessage = { role: "system" | "user"; content: string };

export interface Provider {
  name: string;
  model: string;
  stream(input: { messages: ChatMessage[]; context: TurnContext; signal: AbortSignal }): AsyncIterable<string>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
