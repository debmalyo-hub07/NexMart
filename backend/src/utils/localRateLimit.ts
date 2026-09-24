/** Bounded per-process protection while the shared Redis limiter is unavailable. */
export class LocalRateLimit {
  private readonly buckets = new Map<string, { count: number; reset: number }>();
  private nextSweep = 0;

  constructor(private readonly capacity = 10000) {}

  consume(key: string, maximum: number, windowMs: number, now = Date.now()) {
    if (now >= this.nextSweep) {
      for (const [id, bucket] of this.buckets) if (bucket.reset <= now) this.buckets.delete(id);
      this.nextSweep = now + Math.min(windowMs, 60000);
    }
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.reset <= now) {
      if (!bucket && this.buckets.size >= this.capacity) return { success: false, remaining: 0, reset: this.nextSweep };
      bucket = { count: 0, reset: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    return { success: bucket.count <= maximum, remaining: Math.max(0, maximum - bucket.count), reset: bucket.reset };
  }
}
