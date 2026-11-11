"use client";

import { createStore, del, get, keys, set } from "idb-keyval";

/**
 * Local asset store. Everything melo owns lives on the device:
 * audio, artwork, lyrics, metadata, playlist covers and custom backgrounds.
 * IndexedDB (not the Cache API) because we need per-asset sizes, dedupe and
 * precise deletion.
 */

const store = createStore("melo-assets", "assets");

export const KEYS = {
  audio: (trackId: string) => `audio:${trackId}`,
  artwork: (hash: string) => `art:${hash}`,
  artworkSmall: (hash: string) => `art-small:${hash}`,
  lyrics: (trackId: string) => `lyrics:${trackId}`,
  meta: (trackId: string) => `meta:${trackId}`,
  playlistArt: (playlistId: string) => `playlist-art:${playlistId}`,
  background: (name: string) => `bg:${name}`,
};

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    return await get<T>(key, store);
  } catch {
    return undefined;
  }
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  try {
    await set(key, value, store);
    return true;
  } catch {
    return false;
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    await del(key, store);
  } catch {
    /* deleting a missing asset is fine */
  }
}

export async function idbKeys(): Promise<string[]> {
  try {
    return (await keys(store)) as string[];
  } catch {
    return [];
  }
}

export function hashUrl(url: string): string {
  // Deterministic, non-cryptographic key for deduping shared artwork.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < url.length; i++) {
    h1 ^= url.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ url.charCodeAt(i), 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

const blobUrls = new Map<string, string>();

/** Object URL for a stored blob, reused for the session. */
export async function getAssetUrl(key: string): Promise<string | null> {
  const existing = blobUrls.get(key);
  if (existing) return existing;
  const blob = await idbGet<Blob>(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  blobUrls.set(key, url);
  return url;
}

export function releaseAssetUrl(key: string) {
  const url = blobUrls.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrls.delete(key);
  }
}

export async function storeBlob(key: string, blob: Blob) {
  return idbSet(key, blob);
}

export async function assetSizes(): Promise<Record<string, number>> {
  const result: Record<string, number> = { audio: 0, artwork: 0, lyrics: 0, metadata: 0, other: 0 };
  const all = await idbKeys();
  for (const key of all) {
    const value = await idbGet<unknown>(key);
    let size = 0;
    if (value instanceof Blob) size = value.size;
    else if (typeof value === "string") size = new Blob([value]).size;
    else if (value) size = new Blob([JSON.stringify(value)]).size;

    if (key.startsWith("audio:")) result.audio += size;
    else if (key.startsWith("art:") || key.startsWith("art-small:")) result.artwork += size;
    else if (key.startsWith("lyrics:")) result.lyrics += size;
    else if (key.startsWith("meta:")) result.metadata += size;
    else result.other += size;
  }
  return result;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage || 0, quota: estimate.quota || 0 };
  } catch {
    return null;
  }
}

export async function clearAssetsByPrefix(prefixes: string[]) {
  const all = await idbKeys();
  await Promise.all(
    all.filter((key) => prefixes.some((p) => key.startsWith(p))).map((key) => idbDel(key)),
  );
}
