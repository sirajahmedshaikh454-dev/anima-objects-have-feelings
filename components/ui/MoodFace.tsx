/** Tiny cartoon face for a mood 0–100: grumpy, meh or happy. */
export default function MoodFace({ mood, size = 16 }: { mood: number; size?: number }) {
  const fill = mood >= 70 ? "var(--sun)" : mood >= 40 ? "var(--orange-soft)" : "var(--orange)";
  const mouth = mood >= 70 ? "M7 14q5 4 10 0" : mood >= 40 ? "M7.5 15h9" : "M7 16q5 -4 10 0";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={`mood ${mood} of 100`} className="shrink-0">
      <circle cx="12" cy="12" r="10" fill={fill} stroke="var(--ink)" strokeWidth="2.2" />
      <circle cx="8.5" cy="10" r="1.5" fill="var(--ink)" />
      <circle cx="15.5" cy="10" r="1.5" fill="var(--ink)" />
      {mood < 40 && <path d="M6 7l4 1.5M18 7l-4 1.5" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />}
      <path d={mouth} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
