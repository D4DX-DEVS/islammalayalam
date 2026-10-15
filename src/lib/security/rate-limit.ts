/**
 * Abuse guards for public endpoints (AI search, the postal-library form): a per-visitor sliding
 * window and a daily cap for the whole site. Both live in this server process's memory (a restart
 * resets them), which is enough to stop casual hammering and bound the day's load; the daily cap
 * also protects against many addresses at once.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** True and counted when `key` is under its limit; false when it must wait. */
  take(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) ?? []).filter((h) => t - h < this.windowMs)
    if (recent.length >= this.max) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(t)
    this.hits.set(key, recent)
    if (this.hits.size > 5_000) this.prune(t)
    return true
  }

  private prune(t: number) {
    for (const [key, list] of this.hits)
      if (!list.some((h) => t - h < this.windowMs)) this.hits.delete(key)
  }
}

export class DailyBudget {
  private day = ''
  private used = 0

  constructor(
    private readonly limit: number,
    private readonly now: () => number = Date.now,
  ) {}

  take(): boolean {
    const today = new Date(this.now()).toISOString().slice(0, 10)
    if (today !== this.day) {
      this.day = today
      this.used = 0
    }
    if (this.used >= this.limit) return false
    this.used += 1
    return true
  }
}
