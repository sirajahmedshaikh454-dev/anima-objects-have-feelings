"use client";
import { useEffect, useState } from "react";
import type { Settings } from "@/lib/db/settings";

type Provider = { name: string; model: string; enabled: boolean; signup: string; lastOk: boolean | null; lastError: string | null; lastLatencyMs: number | null };
type Status = { settings: Settings; providers: Provider[]; vision: { ok: boolean; detail: string; avgMs: number | null; scans: number } };

const LABEL: Record<string, string> = { groq: "Groq", gemini: "Gemini", openrouter: "OpenRouter", ollama: "Ollama", mock: "Mock (offline)" };

const Dot = ({ ok }: { ok: boolean | null }) => (
  <span className={`inline-block h-3 w-3 shrink-0 rounded-full border-2 border-ink ${ok === null ? "bg-paper" : ok ? "bg-mint" : "bg-danger"}`} aria-hidden="true" />
);

/** FR-15: scan interval, voice, chattiness, provider status, reset data. */
export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = () => fetch("/api/settings").then((r) => r.json()).then(setStatus);
  useEffect(() => {
    void load();
  }, []);

  const save = async (patch: Partial<Settings>) => {
    const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (r.ok) {
      const j = (await r.json()) as { settings: Settings };
      setStatus((s) => (s ? { ...s, settings: j.settings } : s));
      setSaved("Saved");
      setTimeout(() => setSaved(null), 1500);
    }
  };

  const reset = async () => {
    if (!confirm("Forget every object, memory and saved image? This cannot be undone.")) return;
    await fetch("/api/settings", { method: "DELETE" });
    setSaved("All data reset");
    void load();
  };

  if (!status) return <p className="font-display text-lg">Loading settings…</p>;
  const s = status.settings;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Settings</h1>
          <p className="text-ink-soft">Tune how chatty your objects are.</p>
        </div>
        <p role="status" className="min-h-6 font-bold text-blue">{saved}</p>
      </header>

      <section className="card flex flex-col gap-5 p-5">
        <div>
          <label htmlFor="interval" className="flex justify-between font-bold">
            <span>Live scan interval</span>
            <span>{(s.scanIntervalMs / 1000).toFixed(1)} s</span>
          </label>
          <input id="interval" type="range" min={500} max={10000} step={250} value={s.scanIntervalMs} onChange={(e) => save({ scanIntervalMs: Number(e.target.value) })} className="w-full accent-[var(--orange)]" />
          <p className="text-sm text-ink-soft">How often the camera checks for changes. Frames are only analysed when the scene changes.</p>
        </div>

        <div>
          <label htmlFor="chat" className="flex justify-between font-bold">
            <span>Chattiness</span>
            <span>up to {s.chattiness} line{s.chattiness > 1 ? "s" : ""} per turn</span>
          </label>
          <input id="chat" type="range" min={1} max={4} step={1} value={s.chattiness} onChange={(e) => save({ chattiness: Number(e.target.value) })} className="w-full accent-[var(--orange)]" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold" id="voice-label">Voice</p>
            <p className="text-sm text-ink-soft">Objects speak out loud with their own pitch (browser speech, free).</p>
          </div>
          <button type="button" className="btn" aria-pressed={s.voice} aria-labelledby="voice-label" onClick={() => save({ voice: !s.voice })} data-testid="voice-toggle">
            {s.voice ? "On" : "Off"}
          </button>
        </div>
      </section>

      <section className="card p-5" data-testid="provider-status">
        <h2 className="mb-3 text-xl font-bold">Brains (free providers)</h2>
        <ul className="flex flex-col gap-2">
          <li className="flex items-center gap-2">
            <Dot ok={status.vision.ok} />
            <b>Mirage vision</b>
            <span className="text-sm text-ink-soft">
              {status.vision.detail}
              {status.vision.avgMs !== null && ` · avg ${status.vision.avgMs} ms over last ${status.vision.scans} scans`}
            </span>
          </li>
          {status.providers.map((p) => (
            <li key={p.name} className="flex flex-wrap items-center gap-2">
              <Dot ok={p.enabled ? p.lastOk : null} />
              <b>{LABEL[p.name] ?? p.name}</b>
              <code className="text-xs">{p.model}</code>
              <span className="text-sm text-ink-soft">
                {!p.enabled ? (
                  <>
                    not configured · <a className="underline" href={p.signup} target="_blank" rel="noreferrer">get a free key</a>
                  </>
                ) : p.lastOk === null ? (
                  "ready, not used yet"
                ) : p.lastOk ? (
                  `OK · ${p.lastLatencyMs} ms`
                ) : (
                  `last call failed: ${p.lastError?.slice(0, 80)}`
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-soft">Order of fallback: Groq → Gemini → OpenRouter → Ollama → offline mock. Add keys in <code>.env</code> and restart.</p>
      </section>

      <section className="card border-danger p-5">
        <h2 className="text-xl font-bold">Danger zone</h2>
        <p className="mb-3 text-sm text-ink-soft">Forget every object, its memories, moods and saved camera frames.</p>
        <button type="button" className="btn btn-danger" onClick={reset}>Reset all data</button>
      </section>
    </div>
  );
}
