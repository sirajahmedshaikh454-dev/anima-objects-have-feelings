"use client";
import type { Box } from "@/lib/vision/types";

type Item = { name: string; box: Box; text?: string };

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/** FR-14: draws the current frame, outlines and bubbles onto a canvas and downloads it as PNG. */
export function exportScenePng(media: HTMLImageElement | HTMLVideoElement, items: Item[], filename = "objects-have-feelings.png") {
  const W = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const H = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(media, 0, 0, W, H);
  const s = Math.max(1, W / 640);
  ctx.lineWidth = 3 * s;
  ctx.font = `600 ${14 * s}px Nunito, sans-serif`;
  for (const it of items) {
    ctx.strokeStyle = "#f97316";
    ctx.strokeRect(it.box.x * W, it.box.y * H, it.box.w * W, it.box.h * H);
    const label = it.text ? `${it.name}: ${it.text}` : it.name;
    const lines = wrap(ctx, label, 220 * s);
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20 * s;
    const bh = lines.length * 18 * s + 14 * s;
    const bx = Math.max(4, Math.min(W - bw - 4, (it.box.x + it.box.w / 2) * W - bw / 2));
    const by = Math.max(4, it.box.y * H - bh - 10 * s);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#2b1a10";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12 * s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2b1a10";
    lines.forEach((l, i) => ctx.fillText(l, bx + 10 * s, by + 20 * s + i * 18 * s));
  }
  ctx.font = `700 ${12 * s}px Fredoka, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText("Objects Have Feelings", 10 * s, H - 10 * s);
  c.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}
