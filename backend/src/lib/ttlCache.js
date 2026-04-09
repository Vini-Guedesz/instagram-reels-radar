class TtlCache {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 300000;
    this.maxEntries = options.maxEntries || 100;
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  get(key) {
    this.pruneExpired();

    const entry = this.entries.get(key);

    if (!entry) {
      this.misses += 1;
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;

    return {
      value: entry.value,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt
    };
  }

  set(key, value, ttlMs = this.ttlMs) {
    this.pruneExpired();

    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (!oldestKey) {
        break;
      }

      this.entries.delete(oldestKey);
      this.evictions += 1;
    }

    const now = Date.now();

    this.entries.set(key, {
      value,
      createdAt: now,
      expiresAt: now + ttlMs
    });

    return value;
  }

  delete(key) {
    return this.entries.delete(key);
  }

  pruneExpired() {
    const now = Date.now();

    for (const [key, entry] of this.entries) {
      if (entry.expiresAt > now) {
        continue;
      }

      this.entries.delete(key);
    }
  }

  getStats() {
    this.pruneExpired();

    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      ttlMs: this.ttlMs,
      maxEntries: this.maxEntries
    };
  }
}

module.exports = {
  TtlCache
};
