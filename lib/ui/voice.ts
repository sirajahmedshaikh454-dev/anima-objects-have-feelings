"use client";
import type { Voice } from "@/lib/personality/soul";

/** FR/2.7: each object speaks with its own pitch and rate via the free Web Speech API. */
export function speak(text: string, voice: Voice) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = Math.max(0, Math.min(2, voice.pitch));
  u.rate = Math.max(0.5, Math.min(2, voice.rate));
  window.speechSynthesis.speak(u); // the browser queues utterances, so lines never talk over each other
}

export const stopSpeaking = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
};

type Recognition = { lang: string; interimResults: boolean; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void };

/** Speech-to-text where the browser supports it (Chrome/Edge/Safari); null otherwise → text input fallback. */
export function createRecognizer(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = navigator.language || "en-US";
  r.interimResults = false;
  return r;
}
