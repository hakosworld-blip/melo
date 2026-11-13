/**
 * Small server-side TTL cache. melo is local-first: no database, no telemetry.
 * Caching provider + lyrics responses keeps navigation instant and avoids
 * hammering public APIs.
 */

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

const MAX_ENTRIES = 600;

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  // Refresh LRU position.
  store.delete(key);
  store.set(key, hit);
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): T {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  return cacheSet(key, value, ttlMs);
}

export function cacheDelete(key: string) {
  store.delete(key);
}

export function cacheSize() {
  return store.size;
}
