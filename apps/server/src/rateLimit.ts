/**
 * Basit, bellekte tutulan sabit pencereli sayaç: her anahtar (ör. IP veya bağlantı) için
 * `windowMs` içinde en fazla `limit` istek. Tek sunuculu kurulum için yeterlidir; birden fazla
 * sunucuya geçilirse sayaçların ortak bir yerde (ör. Redis) tutulması gerekir.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private calls = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Bir istek sayar; sınır aşıldıysa false döner. */
  take(key: string): boolean {
    const entry = this.current(key);
    entry.count += 1;
    return entry.count <= this.limit;
  }

  /** Saymadan, anahtarın sınırı aşıp aşmadığını söyler. */
  isLimited(key: string): boolean {
    const entry = this.hits.get(key);
    return !!entry && entry.resetAt > this.now() && entry.count >= this.limit;
  }

  forget(key: string) {
    this.hits.delete(key);
  }

  private current(key: string) {
    const now = this.now();
    // Bellek şişmesin diye ara sıra süresi dolmuş kayıtlar temizlenir.
    if (++this.calls % 1000 === 0) {
      for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
    }
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    return entry;
  }
}
