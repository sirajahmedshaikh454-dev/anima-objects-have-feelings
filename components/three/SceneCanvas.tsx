"use client";
import { useGSAP } from "@gsap/react";
import { Line, Sparkles } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import MoodFace from "@/components/ui/MoodFace";
import { layoutBubbles } from "@/lib/realtime/layout";
import type { SceneObject } from "@/lib/realtime/pipeline";

gsap.registerPlugin(useGSAP);

export type BubbleState = { text: string; emotion: string; streaming: boolean };

const EMOTION_BG: Record<string, string> = {
  happy: "#fef9c3", excited: "#fef08a", grumpy: "#fed7aa", sad: "#dbeafe", jealous: "#d1fae5",
  smug: "#fce7f3", surprised: "#ede9fe", nervous: "#e0f2fe", sleepy: "#f1f5f9", curious: "#ffffff",
};


type Props = {
  width: number;
  height: number;
  objects: SceneObject[];
  bubbles: Record<number, BubbleState>;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
  onConfirm: (id: number, same: boolean) => void;
};

/** Normalized 0..1 image coords → orthographic world coords (1 unit = 1 px, origin at centre). */
const toWorld = (x: number, y: number, W: number, H: number) => new THREE.Vector2(x * W - W / 2, H / 2 - y * H);

function estimateSize(text: string, hasText: boolean) {
  if (!hasText) return { w: Math.min(170, 46 + text.length * 8), h: 34 };
  const w = Math.max(120, Math.min(230, 36 + text.length * 7));
  const perLine = Math.max(10, Math.floor((w - 24) / 7.2));
  return { w, h: 46 + Math.ceil(text.length / perLine) * 19 };
}

function ObjectGlow({ o, W, H, hovered, onHover, onSelect }: { o: SceneObject; W: number; H: number; hovered: boolean; onHover: Props["onHover"]; onSelect: Props["onSelect"] }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const pts = useMemo(() => {
    const poly = o.mask && o.mask.length >= 3 ? o.mask : [[o.box.x, o.box.y], [o.box.x + o.box.w, o.box.y], [o.box.x + o.box.w, o.box.y + o.box.h], [o.box.x, o.box.y + o.box.h]];
    return poly.map(([x, y]) => toWorld(x, y, W, H));
  }, [o.mask, o.box, W, H]);
  const shape = useMemo(() => new THREE.Shape(pts), [pts]);
  const outline = useMemo(() => [...pts, pts[0]].map((p) => [p.x, p.y, 1] as [number, number, number]), [pts]);

  useGSAP(() => {
    if (mat.current) gsap.to(mat.current, { opacity: hovered ? 0.38 : 0.08, duration: 0.25, ease: "power2.out" });
  }, [hovered]);

  return (
    <group>
      <mesh
        onPointerOver={(e) => (e.stopPropagation(), onHover(o.objectId), (document.body.style.cursor = "pointer"))}
        onPointerOut={() => (onHover(null), (document.body.style.cursor = ""))}
        onClick={(e) => (e.stopPropagation(), onSelect(o.objectId))}
      >
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial ref={mat} color="#f97316" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <Line points={outline} color={hovered ? "#facc15" : "#f97316"} lineWidth={hovered ? 4 : 2.5} transparent opacity={0.95} />
    </group>
  );
}

function Bubble({ o, b, target, stageW, onSize, onSelect, onConfirm }: { o: SceneObject; b?: BubbleState; stageW: number; target: { x: number; y: number }; onSize: (id: number, w: number, h: number) => void; onSelect: Props["onSelect"]; onConfirm: Props["onConfirm"] }) {
  const card = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Report the real rendered size so the collision layout never works from guesses.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onSize(o.objectId, el.offsetWidth, el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [o.objectId, onSize]);

  // FR-09: bubbles pop in, then glide to their new spot when the object (or a neighbour) moves.
  useGSAP(() => {
    const el = card.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      gsap.set(el, { x: target.x, y: target.y });
      gsap.from(el, { scale: 0.4, opacity: 0, duration: 0.45, ease: "back.out(2)" });
    } else gsap.to(el, { x: target.x, y: target.y, duration: 0.6, ease: "power3.out" });
  }, [target.x, target.y]);

  // A little hop whenever a new line starts.
  const lineKey = b?.streaming ? "s" : (b?.text ?? "");
  useGSAP(() => {
    if (card.current && b?.text) gsap.fromTo(card.current, { scale: 1.06 }, { scale: 1, duration: 0.35, ease: "bounce.out" });
  }, [lineKey]);

  const hasText = !!b?.text;
  return (
    <div
      ref={card}
      className={`bubble pointer-events-auto absolute left-0 top-0 w-max text-sm ${b?.streaming ? "caret" : ""}`}
      style={{ maxWidth: Math.min(240, stageW * 0.6), background: hasText ? (EMOTION_BG[b!.emotion] ?? "#fff") : "#fff" }}
      data-testid={`bubble-${o.objectId}`}
    >
      <button type="button" onClick={() => onSelect(o.objectId)} className="flex w-full cursor-pointer items-center gap-1 text-left font-display text-[13px] font-bold leading-tight text-ink-soft" aria-label={`Open ${o.name}'s soul card`}>
        <MoodFace mood={o.mood} />
        <span className="truncate">{o.name}</span>
      </button>
      {hasText && (
        <p className="mt-0.5 text-[14px] text-ink" aria-live="polite">
          {b!.text}
        </p>
      )}
      {o.needsConfirm && (
        <div className="mt-1.5 flex items-center gap-1 text-[12px]">
          <span>Same {o.label}?</span>
          <button type="button" className="cursor-pointer rounded-full border-2 border-ink bg-mint px-2 font-bold" onClick={() => onConfirm(o.objectId, true)}>Yes</button>
          <button type="button" className="cursor-pointer rounded-full border-2 border-ink bg-orange-soft px-2 font-bold" onClick={() => onConfirm(o.objectId, false)}>No</button>
        </div>
      )}
    </div>
  );
}

export default function SceneCanvas({ width: W, height: H, objects, bubbles, hoveredId, onHover, onSelect, onConfirm }: Props) {
  const [measured, setMeasured] = useState<Record<number, { w: number; h: number }>>({});
  const onSize = useCallback((id: number, w: number, h: number) => {
    setMeasured((m) => (m[id]?.w === w && m[id]?.h === h ? m : { ...m, [id]: { w, h } }));
  }, []);
  const sizes = useMemo(
    () => new Map(objects.map((o) => [o.objectId, measured[o.objectId] ?? estimateSize(bubbles[o.objectId]?.text || o.name, !!bubbles[o.objectId]?.text)])),
    [objects, bubbles, measured],
  );
  const targets = useMemo(() => {
    const placed = layoutBubbles(
      objects.map((o) => ({ id: o.objectId, anchorX: (o.box.x + o.box.w / 2) * W, anchorY: o.box.y * H + 8, ...sizes.get(o.objectId)! })),
      { w: W, h: H },
    );
    return new Map(placed.map((p) => [p.id, { x: p.x, y: p.y }]));
  }, [objects, sizes, W, H]);

  return (
    <>
    <Canvas
      orthographic
      camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
      onPointerMissed={() => onHover(null)}
      aria-label="Talking objects"
    >
      <Sparkles count={40} scale={[W, H, 10]} size={6} speed={0.4} color="#facc15" opacity={0.7} />
      {objects.map((o) => (
        <ObjectGlow key={o.objectId} o={o} W={W} H={H} hovered={hoveredId === o.objectId} onHover={onHover} onSelect={onSelect} />
      ))}
    </Canvas>
    {/* Bubbles are a DOM layer in the same pixel space as the orthographic scene: crisp, accessible text. */}
    <div className="pointer-events-none absolute inset-0 z-20">
      {objects.map((o) => (
        <Bubble key={o.objectId} o={o} b={bubbles[o.objectId]} target={targets.get(o.objectId)!} stageW={W} onSize={onSize} onSelect={onSelect} onConfirm={onConfirm} />
      ))}
    </div>
    </>
  );
}
