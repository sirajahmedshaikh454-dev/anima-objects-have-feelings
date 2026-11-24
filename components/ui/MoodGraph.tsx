/** FR-12: mood history as a small line chart (0 = grumpy, 100 = happy). */
export default function MoodGraph({ points, height = 90 }: { points: { mood: number; at: number }[]; height?: number }) {
  const W = 300, H = height, pad = 8;
  if (points.length === 0) return <p className="text-sm text-ink-soft">No mood history yet.</p>;
  const pts = points.length === 1 ? [points[0], points[0]] : points;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (m: number) => H - pad - (m / 100) * (H - pad * 2);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.mood).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Mood over time, now ${last.mood} of 100`}>
        <rect x="0" y="0" width={W} height={H} rx="12" fill="var(--peach)" />
        <line x1={pad} x2={W - pad} y1={y(50)} y2={y(50)} stroke="var(--orange-soft)" strokeWidth="2" strokeDasharray="5 5" />
        <path d={`${d} L${x(pts.length - 1)},${H - pad} L${x(0)},${H - pad} Z`} fill="var(--orange)" opacity="0.18" />
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(last.mood)} r="5" fill="var(--sun)" stroke="var(--ink)" strokeWidth="2.5" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-ink-soft">
        <span>grumpy ↓</span>
        <span>now {last.mood}/100</span>
        <span>happy ↑</span>
      </figcaption>
    </figure>
  );
}
