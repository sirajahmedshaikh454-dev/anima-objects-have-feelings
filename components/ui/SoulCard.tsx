"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SoulCard as Card } from "@/lib/db/queries";
import { streamTalk } from "@/lib/ui/talk";
import { createRecognizer } from "@/lib/ui/voice";
import MoodFace from "./MoodFace";
import MoodGraph from "./MoodGraph";

gsap.registerPlugin(useGSAP);

type Props = {
  id: number;
  presentIds: number[];
  onClose: () => void;
  onLine: (id: number, text: string, emotion: string, streaming: boolean) => void;
};

const KIND_COLOR: Record<string, string> = { friend: "bg-mint", rival: "bg-orange-soft", crush: "bg-pink", ignore: "bg-peach" };

export default function SoulCard({ id, presentIds, onClose, onLine }: Props) {
  const [card, setCard] = useState<Card | null>(null);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<{ text: string; streaming: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen] = useState(() => !!createRecognizer());
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(() => fetch(`/api/objects/${id}`).then((r) => (r.ok ? r.json() : null)).then(setCard), [id]);
  useEffect(() => {
    void load();
    dialog.current?.showModal();
  }, [load]);
  useGSAP(() => {
    if (panel.current) gsap.from(panel.current, { y: 30, scale: 0.94, opacity: 0, duration: 0.4, ease: "back.out(1.7)" });
  }, []);

  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setBusy(true);
    setAnswer({ text: "", streaming: true });
    let final = "";
    const r = await streamTalk("/api/reply", { objectId: id, text: msg, presentIds }, {
      onDelta: (_oid, t) => (setAnswer({ text: t, streaming: true }), onLine(id, t, "curious", true)),
      onLine: (l) => ((final = l.text), setAnswer({ text: l.text, streaming: false }), onLine(id, l.text, l.emotion, false)),
    });
    if (r.error) setAnswer({ text: `(${r.error})`, streaming: false });
    else if (!final) setAnswer(null);
    setText("");
    setBusy(false);
    void load();
  };

  const listen = () => {
    const rec = createRecognizer();
    if (!rec) return;
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript;
      setText(said);
      void send(said);
    };
    rec.onerror = rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto max-h-[92dvh] w-[min(560px,94vw)] bg-transparent p-0 backdrop:bg-ink/50"
      aria-labelledby="soul-title"
      data-testid="soul-card"
    >
      <div ref={panel} className="card max-h-[92dvh] overflow-y-auto p-5">
        {!card ? (
          <p className="p-6 text-center font-display text-lg">Summoning soul…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <MoodFace mood={card.mood} size={44} />
                <div>
                  <h2 id="soul-title" className="text-2xl font-bold leading-tight">{card.name}</h2>
                  <p className="text-ink-soft">
                    the {card.label} · seen {card.timesSeen}× · since {new Date(card.firstSeen).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button type="button" className="btn min-h-[44px] min-w-[44px] px-0" onClick={() => dialog.current?.close()} aria-label="Close soul card">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </header>

            <ul className="flex flex-wrap gap-2" aria-label="Traits">
              {card.traits.map((t) => (
                <li key={t} className="rounded-full border-2 border-ink bg-sun px-3 py-0.5 font-display font-semibold">{t}</li>
              ))}
            </ul>

            <section>
              <h3 className="mb-1 font-bold">Mood</h3>
              <MoodGraph points={card.moodHistory} />
            </section>

            {card.relationships.length > 0 && (
              <section>
                <h3 className="mb-1 font-bold">Relationships</h3>
                <ul className="flex flex-wrap gap-2">
                  {card.relationships.map((r, i) => (
                    <li key={i} className={`rounded-full border-2 border-ink px-3 py-0.5 text-sm ${KIND_COLOR[r.kind] ?? "bg-peach"}`}>
                      <b>{r.kind}</b> of {r.other?.name ?? "someone"} {r.strength > 1 && `×${r.strength}`}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-1 font-bold">Talk to {card.name}</h3>
              {answer && (
                <p className={`bubble mb-4 ${answer.streaming ? "caret" : ""}`} aria-live="polite">
                  {answer.text}
                </p>
              )}
              <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), void send(text))}>
                <label htmlFor="reply" className="sr-only">Your message</label>
                <input
                  id="reply"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={300}
                  placeholder={`Say hi to ${card.name}…`}
                  className="min-h-[44px] flex-1 rounded-full border-[2.5px] border-ink bg-paper px-4"
                  disabled={busy}
                />
                {canListen && (
                  <button type="button" className="btn min-w-[44px] px-3" onClick={listen} aria-pressed={listening} aria-label="Speak your message" disabled={busy}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>Send</button>
              </form>
            </section>

            <section>
              <h3 className="mb-1 font-bold">Memories</h3>
              {card.memories.length === 0 ? (
                <p className="text-sm text-ink-soft">Nothing yet. Make some memories!</p>
              ) : (
                <ol className="flex flex-col gap-1.5 text-sm">
                  {card.memories.map((m) => (
                    <li key={m.id} className="flex gap-2">
                      <span className={`shrink-0 rounded-full border-2 border-ink px-2 text-xs font-bold ${m.type === "said" ? "bg-sun" : m.type === "heard" ? "bg-mint" : "bg-peach"}`}>{m.type}</span>
                      <span>{m.content}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </dialog>
  );
}
