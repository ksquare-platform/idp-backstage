const TTL_MS = 5 * 60 * 1000;

type Entry<T> = { value: T; expiresAt: number };

// A tiny in-memory TTL cache that keeps serving the last value past its
// expiry (via `getStale`) so a GitHub rate limit can fall back to slightly
// old data instead of failing outright.
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      return undefined;
    }
    return entry.value;
  }

  getStale(key: string): T | undefined {
    return this.store.get(key)?.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + TTL_MS });
  }
}
