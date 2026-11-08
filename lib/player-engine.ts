"use client";

import { KEYS, getAssetUrl } from "@/lib/storage";
import type { Track } from "@/lib/types";

/**
 * Thin wrapper over a single HTMLAudioElement. Playback state deliberately
 * lives outside React so the UI can unmount without interrupting audio.
 */

let element: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

export function audioElement(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = "metadata";
    element.crossOrigin = "anonymous";
  }
  return element;
}

export function streamPath(track: Track) {
  return `/api/stream/${track.provider}/${encodeURIComponent(track.providerId)}`;
}

export async function resolveSource(track: Track, useOffline: boolean): Promise<string> {
  if (useOffline) {
    const url = await getAssetUrl(KEYS.audio(track.id));
    if (url) return url;
  }
  return streamPath(track);
}

export function releaseSource() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

export function setObjectUrl(url: string) {
  objectUrl = url;
}

/** Resolves once metadata is available (or immediately on timeout). */
export function whenMetadata(el: HTMLAudioElement, timeout = 6000): Promise<void> {
  if (el.readyState >= 1) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener("loadedmetadata", done);
      el.removeEventListener("error", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeout);
    el.addEventListener("loadedmetadata", done);
    el.addEventListener("error", done);
  });
}

export function applyMediaSession(track: Track | null, artworkUrl?: string) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !track) return;
  const artwork = artworkUrl || track.artwork;
  const absolute = artwork
    ? new URL(`/api/image?src=${encodeURIComponent(artwork)}`, window.location.origin).toString()
    : undefined;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || "melo",
      artwork: absolute
        ? [
            { src: absolute, sizes: "480x480", type: "image/jpeg" },
            { src: absolute, sizes: "1000x1000", type: "image/jpeg" },
          ]
        : [],
    });
  } catch {
    /* MediaMetadata is best-effort */
  }
}

/** Keeps the OS/lock-screen play state in sync with the actual element. */
export function setMediaPlaybackState(state: MediaSessionPlaybackState) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {
    /* best effort — unsupported states are ignored */
  }
}

export function updatePositionState(position: number, duration: number, rate = 1) {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  if (!("setPositionState" in navigator.mediaSession) || !duration || !Number.isFinite(duration)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: rate,
      position: Math.min(Math.max(0, position), duration),
    });
  } catch {
    /* Some browsers reject transient states; harmless. */
  }
}
