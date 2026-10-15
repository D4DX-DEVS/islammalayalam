import { DailyBudget, RateLimiter } from '@/lib/security/rate-limit'

// The guards moved to lib/security (shared with the postal-library form); re-exported for AI search.
export { DailyBudget, RateLimiter }

/** A small in-memory cache of finished answers: the same question is answered once per TTL, whoever asks. */
export class TtlCache<V> {
  private entries = new Map<string, { value: V; expires: number }>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.entries.get(key)
    if (!hit) return undefined
    if (hit.expires <= this.now()) {
      this.entries.delete(key)
      return undefined
    }
    return hit.value
  }

  set(key: string, value: V): void {
    this.entries.delete(key)
    this.entries.set(key, { value, expires: this.now() + this.ttlMs })
    // Maps iterate in insertion order, so the first key is the oldest.
    while (this.entries.size > this.maxEntries)
      this.entries.delete(this.entries.keys().next().value!)
  }
}
