"use client";

import { useSyncExternalStore } from "react";

/**
 * Playback position lives outside React state on purpose: the seek bar and
 * lyrics redraw at animation rate while nothing else in the tree re-renders.
 */
export interface Progress {
  position: number;
  duration: number;
  buffered: number;
  playing: boolean;
  loading: boolean;
}

let snapshot: Progress = { position: 0, duration: 0, buffered: 0, playing: false, loading: false };
/** Stable object for hydration; React requires a cached server snapshot. */
const initialSnapshot = snapshot;
const listeners = new Set<() => void>();

export const progressStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot() {
    return snapshot;
  },
  update(patch: Partial<Progress>) {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof Progress)[]) {
      if (snapshot[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((l) => l());
  },
  reset() {
    snapshot = { position: 0, duration: 0, buffered: 0, playing: false, loading: false };
    listeners.forEach((l) => l());
  },
};

export function useProgress<T = Progress>(selector?: (progress: Progress) => T): T {
  const current = useSyncExternalStore(
    progressStore.subscribe,
    progressStore.getSnapshot,
    () => initialSnapshot,
  );
  return selector ? selector(current) : (current as unknown as T);
}
