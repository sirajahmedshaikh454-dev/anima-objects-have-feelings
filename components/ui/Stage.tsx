"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BubbleState } from "@/components/three/SceneCanvas";
import type { Settings } from "@/lib/db/settings";
import type { ChangeEvent } from "@/lib/realtime/changes";
import { FrameGate } from "@/lib/realtime/frameGate";
import type { ScanResult, SceneObject } from "@/lib/realtime/pipeline";
import { exportScenePng } from "@/lib/ui/exportPng";
import { streamTalk } from "@/lib/ui/talk";
import { speak, stopSpeaking } from "@/lib/ui/voice";
import SoulCard from "./SoulCard";

const SceneCanvas = dynamic(() => import("@/components/three/SceneCanvas"), { ssr: false });

type Media = { kind: "image"; url: string } | { kind: "video" } | null;
type Notice = { tone: "info" | "error"; text: string; hint?: string; retry?: Blob } | null;
type TalkEvent = Pick<ChangeEvent, "type" | "objectId" | "otherId">;

const DEFAULTS: Settings = { scanIntervalMs: 1500, voice: false, chattiness: 2 };

export default function Stage() {
  const [mode, setMode] = useState<"upload" | "live">("upload");
  const [media, setMedia] = useState<Media>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [bubbles, setBubbles] = useState<Record<number, BubbleState>>({});
  const [status, setStatus] = useState<"idle" | "looking" | "talking">("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const [provider, setProvider] = useState<string>("—");
  const [latency, setLatency] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [voiceOn, setVoiceOn] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionId = useRef<string>("");
  const objectsRef = useRef<SceneObject[]>([]);
  const scanIdRef = useRef<number | null>(null);
  const settingRef = useRef<string | null>(null);
  const pending = useRef<TalkEvent[]>([]);
  const talkBusy = useRef(false);
  const voiceRef = useRef(false);
  const runTalkRef = useRef<() => void>(() => {});
  const talkLater = (ms: number) => setTimeout(() => runTalkRef.current(), ms);

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j: { settings: Settings }) => {
        setSettings(j.settings);
        setVoiceOn(j.settings.voice);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    voiceRef.current = voiceOn;
    if (!voiceOn) stopSpeaking();
  }, [voiceOn]);
  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  // Fit the stage to the available width (and 70% of the viewport height) at the media's aspect ratio.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const maxW = el.clientWidth, maxH = window.innerHeight * 0.7;
      const w = Math.min(maxW, maxH * aspect);
      setBox({ w: Math.round(w), h: Math.round(w / aspect) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => (ro.disconnect(), window.removeEventListener("resize", fit));
  }, [aspect]);

  const runTalk = useCallback(async () => {
    if (talkBusy.current || !pending.current.length || !objectsRef.current.length) return;
    talkBusy.current = true;
    const events = pending.current.splice(0);
    setStatus("talking");
    const emotions: Record<number, string> = {};
    try {
      const r = await streamTalk(
        "/api/talk",
        { sessionId: sessionId.current, presentIds: objectsRef.current.map((o) => o.objectId), events, setting: settingRef.current },
        {
          onProvider: setProvider,
          onDelta: (id, text) => setBubbles((b) => ({ ...b, [id]: { text, emotion: emotions[id] ?? b[id]?.emotion ?? "curious", streaming: true } })),
          onLine: (l) => {
            const id = Number(l.object_id);
            emotions[id] = l.emotion;
            setBubbles((b) => ({ ...b, [id]: { text: l.text, emotion: l.emotion, streaming: false } }));
            const o = objectsRef.current.find((x) => x.objectId === id);
            if (voiceRef.current && o) speak(l.text, o.voice);
          },
          onReset: () => setBubbles((b) => Object.fromEntries(Object.entries(b).filter(([, v]) => !v.streaming))),
        },
      );
      if (r.retryAfterMs) {
        // Rate-limited (max one line every 3 s): keep the events and try again later.
        pending.current.unshift(...events);
        talkLater(r.retryAfterMs + 50);
      } else if (r.error) setNotice({ tone: "error", text: "The objects lost their voice for a moment.", hint: r.error });
    } catch (e) {
      setNotice({ tone: "error", text: "Could not reach the server.", hint: (e as Error).message });
    } finally {
      talkBusy.current = false;
      setBubbles((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { ...v, streaming: false }])));
      setStatus("idle");
      if (pending.current.length) talkLater(3000);
    }
  }, []);
  useEffect(() => {
    runTalkRef.current = () => void runTalk();
  }, [runTalk]);

  const scan = useCallback(
    async (blob: Blob, scanMode: "upload" | "live") => {
      setStatus("looking");
      const fd = new FormData();
      fd.append("image", blob, "frame.jpg");
      fd.append("mode", scanMode);
      fd.append("sessionId", sessionId.current);
      try {
        const res = await fetch("/api/scan", { method: "POST", body: fd });
        const j = await res.json();
        if (!res.ok) {
          setNotice({ tone: "error", text: j.error ?? "Scan failed.", hint: j.hint ?? j.detail, retry: scanMode === "upload" && res.status === 503 ? blob : undefined });
          return false;
        }
        const r = j as ScanResult;
        scanIdRef.current = r.scanId;
        settingRef.current = r.setting;
        setLatency(Math.round(r.latencyMs));
        setObjects(r.objects);
        objectsRef.current = r.objects;
        const present = new Set(r.objects.map((o) => o.objectId));
        setBubbles((b) => Object.fromEntries(Object.entries(b).filter(([k]) => present.has(Number(k)))));
        if (!r.objects.length) setNotice({ tone: "info", text: "Your objects are asleep. Try more light, or get a little closer." });
        else setNotice(null);
        if (r.events.length) {
          pending.current.push(...r.events.map(({ type, objectId, otherId }) => ({ type, objectId, otherId })));
          void runTalk();
        }
        return true;
      } catch (e) {
        setNotice({ tone: "error", text: "Could not reach the server.", hint: (e as Error).message, retry: scanMode === "upload" ? blob : undefined });
        return false;
      } finally {
        setStatus((s) => (s === "looking" ? "idle" : s));
      }
    },
    [runTalk],
  );

  const reset = () => {
    setObjects([]);
    setBubbles({});
    objectsRef.current = [];
    pending.current = [];
    setNotice(null);
    sessionId.current = crypto.randomUUID();
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => stopCamera, [stopCamera]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setNotice({ tone: "error", text: "That file is not an image." });
    stopCamera();
    reset();
    setMode("upload");
    if (media?.kind === "image") URL.revokeObjectURL(media.url);
    setMedia({ kind: "image", url: URL.createObjectURL(f) });
    void scan(f, "upload");
  };

  const samples = ["kitchen", "cats", "living-room"];
  const sampleIdx = useRef(0);
  const trySample = async () => {
    const name = samples[sampleIdx.current++ % samples.length];
    const blob = await fetch(`/samples/${name}.jpg`).then((r) => r.blob());
    onFile(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
  };

  const startCamera = async () => {
    reset();
    setMode("live");
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice({ tone: "error", text: "This browser can't open the camera here.", hint: "Phones need HTTPS: run `npm run dev:https` and open the https:// address. On this PC, http://localhost works." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      setMedia({ kind: "video" });
    } catch (e) {
      setMode("upload");
      setNotice({ tone: "error", text: "Camera access was blocked.", hint: `${(e as Error).message}. Allow the camera in your browser, or upload a photo instead.` });
    }
  };

  // Live loop: sample a tiny frame every interval; send a full frame only if the scene changed and nothing is in flight.
  useEffect(() => {
    if (mode !== "live" || media?.kind !== "video") return;
    const video = videoRef.current!;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {});
    const gate = new FrameGate();
    const tiny = document.createElement("canvas");
    tiny.width = 64;
    tiny.height = 48;
    const tctx = tiny.getContext("2d", { willReadFrequently: true })!;
    const full = document.createElement("canvas");
    const timer = setInterval(() => {
      if (video.readyState < 2 || !video.videoWidth) return;
      setAspect(video.videoWidth / video.videoHeight);
      tctx.drawImage(video, 0, 0, 64, 48);
      if (!gate.offer(tctx.getImageData(0, 0, 64, 48).data)) return;
      const s = Math.min(1, 640 / video.videoWidth);
      full.width = Math.round(video.videoWidth * s);
      full.height = Math.round(video.videoHeight * s);
      full.getContext("2d")!.drawImage(video, 0, 0, full.width, full.height);
      full.toBlob(async (blob) => {
        const ok = blob ? await scan(blob, "live") : false;
        if (ok) gate.done();
        else setTimeout(() => gate.reset(), 3000); // back off after an error
      }, "image/jpeg", 0.85);
    }, settings.scanIntervalMs);
    return () => clearInterval(timer);
  }, [mode, media, scan, settings.scanIntervalMs]);

  const confirm = async (id: number, same: boolean) => {
    const res = await fetch(`/api/objects/${id}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ same, scanId: scanIdRef.current }) });
    if (!res.ok) return;
    const j = (await res.json()) as { objectId: number; name?: string; traits?: string[]; voice?: SceneObject["voice"]; mood?: number };
    setObjects((os) => os.map((o) => (o.objectId === id ? { ...o, needsConfirm: false, ...(same ? {} : { objectId: j.objectId, name: j.name!, traits: j.traits!, voice: j.voice!, mood: j.mood!, isNew: true }) } : o)));
    if (!same) {
      pending.current.push({ type: "appeared", objectId: j.objectId });
      talkLater(100);
    }
  };

  const exportPng = () => {
    const el = media?.kind === "video" ? videoRef.current : imgRef.current;
    if (el) exportScenePng(el, objects.map((o) => ({ name: o.name, box: o.box, text: bubbles[o.objectId]?.text })));
  };

  const busyLabel = status === "looking" ? "Looking around…" : status === "talking" ? "Chatting…" : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Point. Wait. Listen.</h1>
          <p className="text-ink-soft">Every object in your photo gets a name, a mood and a memory.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="btn btn-primary">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3M12 4v12M7 9l5-5 5 5" /></svg>
            Upload photo
            <input type="file" accept="image/*" className="sr-only" data-testid="upload" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {mode === "live" && media?.kind === "video" ? (
            <button type="button" className="btn" onClick={() => (stopCamera(), setMedia(null), setMode("upload"), reset())}>
              Stop camera
            </button>
          ) : (
            <button type="button" className="btn btn-blue" onClick={startCamera} data-testid="start-camera">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>
              Live camera
            </button>
          )}
          <button type="button" className="btn" onClick={trySample} data-testid="try-sample">
            Try a sample
          </button>
          <button type="button" className="btn" aria-pressed={voiceOn} onClick={() => setVoiceOn((v) => !v)}>
            Voice {voiceOn ? "on" : "off"}
          </button>
          <button type="button" className="btn" onClick={exportPng} disabled={!objects.length}>
            Save PNG
          </button>
        </div>
      </section>

      {notice && (
        <div role={notice.tone === "error" ? "alert" : "status"} className={`card flex flex-wrap items-center gap-3 px-4 py-3 ${notice.tone === "error" ? "bg-orange-soft" : "bg-peach"}`}>
          <div className="flex-1">
            <p className="font-bold">{notice.text}</p>
            {notice.hint && <p className="text-sm text-ink-soft">{notice.hint}</p>}
          </div>
          {notice.retry && (
            <button type="button" className="btn" onClick={() => notice.retry && void scan(notice.retry, "upload")}>Retry</button>
          )}
        </div>
      )}

      <div ref={wrapRef} className="w-full">
        <div
          className="card relative mx-auto overflow-hidden bg-ink"
          style={{ width: box.w || "100%", height: media ? box.h : undefined, minHeight: media ? undefined : 320 }}
          data-testid="stage"
        >
          {!media && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 bg-peach p-6 text-center">
              <svg viewBox="0 0 160 90" className="w-56" aria-hidden="true">
                <rect x="20" y="30" width="36" height="44" rx="9" fill="var(--orange)" stroke="var(--ink)" strokeWidth="4" />
                <path d="M56 40h6a9 9 0 0 1 0 18h-6" fill="none" stroke="var(--ink)" strokeWidth="4" />
                <circle cx="32" cy="48" r="3" fill="var(--ink)" /><circle cx="44" cy="48" r="3" fill="var(--ink)" />
                <path d="M32 58q6 5 12 0" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
                <rect x="96" y="16" width="34" height="60" rx="7" fill="var(--blue)" stroke="var(--ink)" strokeWidth="4" />
                <circle cx="107" cy="40" r="3" fill="#fff" /><circle cx="119" cy="40" r="3" fill="#fff" />
                <path d="M107 52q6 -4 12 0" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M70 18q10 -10 20 0" fill="none" stroke="var(--ink)" strokeWidth="3" strokeDasharray="4 5" />
              </svg>
              <p className="font-display text-2xl font-bold">Your stuff is waiting to be heard.</p>
              <p className="max-w-md text-ink-soft">Upload a photo or start the live camera. Mugs, pens, plants, phones, all of them have opinions.</p>
            </div>
          )}
          {media?.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL, next/image can't optimise it
            <img ref={imgRef} src={media.url} alt="Your photo" className="absolute inset-0 h-full w-full object-fill" onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
          )}
          {media?.kind === "video" && <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-fill" aria-label="Live camera" />}
          {media && box.w > 0 && (
            <SceneCanvas width={box.w} height={box.h} objects={objects} bubbles={bubbles} hoveredId={hovered} onHover={setHovered} onSelect={setSelected} onConfirm={confirm} />
          )}
          {busyLabel && (
            <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-full border-2 border-ink bg-sun px-3 py-1 font-display text-sm font-bold shadow-[2px_2px_0_0_var(--ink)]" role="status">
              {busyLabel}
            </div>
          )}
          {media && (
            <div className="pointer-events-none absolute bottom-2 right-2 z-30 rounded-full border-2 border-ink bg-paper/90 px-2.5 py-0.5 text-xs font-bold" data-testid="provider-badge">
              LLM: {provider}
              {latency !== null && ` · vision ${latency} ms`}
            </div>
          )}
        </div>
      </div>

      {objects.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Objects in view">
          {objects.map((o) => (
            <li key={o.objectId}>
              <button
                type="button"
                className="btn min-h-[40px] px-3 py-1 text-sm"
                onMouseEnter={() => setHovered(o.objectId)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(o.objectId)}
                onBlur={() => setHovered(null)}
                onClick={() => setSelected(o.objectId)}
              >
                {o.name} <span className="font-sans font-normal text-ink-soft">the {o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected !== null && (
        <SoulCard
          id={selected}
          presentIds={objects.map((o) => o.objectId)}
          onClose={() => setSelected(null)}
          onLine={(id, text, emotion, streaming) => {
            setBubbles((b) => ({ ...b, [id]: { text, emotion, streaming } }));
            const o = objectsRef.current.find((x) => x.objectId === id);
            if (!streaming && voiceRef.current && o) speak(text, o.voice);
          }}
        />
      )}
    </div>
  );
}
