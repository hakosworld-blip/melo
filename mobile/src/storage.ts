import * as FileSystem from 'expo-file-system/legacy';

/**
 * Two small JSON files in the app's private storage: playlists and settings.
 * Nothing leaves the device. Writes are debounced and atomic enough for a music
 * app — a crash can lose the last second of changes, never the whole library.
 */

const folder = FileSystem.documentDirectory ?? '';

function uriFor(name: string) {
  return `${folder}${name}.json`;
}

export async function loadJson<T>(name: string): Promise<T | null> {
  try {
    const path = uriFor(name);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, string>();

async function flush(name: string) {
  const value = pending.get(name);
  pending.delete(name);
  if (value === undefined) return;
  try {
    await FileSystem.writeAsStringAsync(uriFor(name), value);
  } catch {
    /* Storage full or unavailable: the in-memory library still works. */
  }
}

export function saveJsonSoon(name: string, value: unknown, delay = 350) {
  try {
    pending.set(name, JSON.stringify(value));
  } catch {
    return;
  }
  const existing = timers.get(name);
  if (existing) clearTimeout(existing);
  timers.set(
    name,
    setTimeout(() => {
      timers.delete(name);
      void flush(name);
    }, delay),
  );
}

/** Write immediately — used when leaving a screen, so nothing waits on a timer. */
export function saveJsonNow(name: string, value: unknown) {
  const existing = timers.get(name);
  if (existing) clearTimeout(existing);
  timers.delete(name);
  pending.set(name, JSON.stringify(value));
  void flush(name);
}
