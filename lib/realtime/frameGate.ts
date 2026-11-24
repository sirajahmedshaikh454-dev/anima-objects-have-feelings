/** Mean absolute difference (0–255) between two equally sized RGBA frames, compared as greyscale. */
export function frameDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length || a.length === 0) return 255;
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    const ga = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
    const gb = b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114;
    sum += Math.abs(ga - gb);
  }
  return sum / (a.length / 4);
}

/**
 * Decides whether a camera frame should go to Mirage: only when the scene changed, and never
 * while a request is in flight (frames arriving meanwhile are simply dropped as stale).
 */
export class FrameGate {
  private last: Uint8ClampedArray | null = null;
  inFlight = false;

  constructor(public threshold = 6) {}

  offer(sample: Uint8ClampedArray): boolean {
    if (this.inFlight) return false;
    if (this.last && frameDifference(this.last, sample) < this.threshold) return false;
    this.last = sample.slice();
    this.inFlight = true;
    return true;
  }

  done() {
    this.inFlight = false;
  }

  /** Forget the reference frame so the next frame is always sent (e.g. after an error). */
  reset() {
    this.last = null;
    this.inFlight = false;
  }
}
