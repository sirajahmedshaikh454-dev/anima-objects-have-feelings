/** FR-07: at most one new line every `gapMs` overall, per session. */
export function createSpeechLimiter(gapMs = 3000) {
  const next = new Map<string, number>();
  return {
    /** ms to wait before this session may speak again (0 = go). */
    wait: (session: string, now = Date.now()) => Math.max(0, (next.get(session) ?? 0) - now),
    /** Books speaking time for `lines` lines starting now. */
    spoke: (session: string, lines: number, now = Date.now()) => next.set(session, now + gapMs * Math.max(1, lines)),
  };
}

const g = globalThis as unknown as { __animaLimiter?: ReturnType<typeof createSpeechLimiter> };
export const speechLimiter = (g.__animaLimiter ??= createSpeechLimiter());
