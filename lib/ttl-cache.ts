export class BoundedCache<T> {
  private entries = new Map<
    string,
    { value: T; expires: number; weight: number }
  >();
  private weight = 0;
  private maxEntries: number;
  private maxWeight: number;
  constructor(maxEntries: number, maxWeight: number) {
    this.maxEntries = maxEntries;
    this.maxWeight = maxWeight;
  }
  get(key: string, now = Date.now()) {
    const item = this.entries.get(key);
    if (!item) return null;
    if (item.expires <= now) {
      this.remove(key);
      return null;
    }
    return item.value;
  }
  set(key: string, value: T, ttl: number, weight = 1, now = Date.now()) {
    this.remove(key);
    for (const [id, item] of this.entries)
      if (item.expires <= now) this.remove(id);
    if (weight > this.maxWeight || ttl <= 0) return;
    while (
      this.entries.size >= this.maxEntries ||
      this.weight + weight > this.maxWeight
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    this.entries.set(key, { value, expires: now + ttl, weight });
    this.weight += weight;
  }
  private remove(key: string) {
    const item = this.entries.get(key);
    if (item) this.weight -= item.weight;
    this.entries.delete(key);
  }
}
