"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { KEYS, getAssetUrl, hashUrl, idbDel, idbGet, idbSet, releaseAssetUrl } from "@/lib/storage";
import type { DownloadRecord, Lyrics, Track } from "@/lib/types";

/**
 * Download manager.
 *
 * Every download stores audio + artwork + lyrics + metadata so the offline
 * library never touches the network. Records live in localStorage (small, fast,
 * survives restart); blobs live in IndexedDB with exact byte accounting.
 * Artwork is deduped by URL hash and only removed when no other download
 * references it.
 */

const MAX_CONCURRENT = 2;

interface DownloadsState {
  records: Record<string, DownloadRecord>;
  order: string[];
  queue: string[];
  active: string[];
  enqueue: (track: Track) => void;
  retry: (trackId: string) => void;
  cancel: (trackId: string) => void;
  remove: (trackId: string) => Promise<void>;
  removeAll: () => Promise<void>;
  recoverInterrupted: () => void;
}

const controllers = new Map<string, AbortController>();

export const useDownloads = create<DownloadsState>()(
  persist(
    (set, get) => ({
      records: {},
      order: [],
      queue: [],
      active: [],

      enqueue: (track) => {
        const existing = get().records[track.id];
        if (existing && (existing.status === "complete" || existing.status === "downloading" || existing.status === "queued")) {
          return;
        }
        const record: DownloadRecord = {
          track,
          status: "queued",
          progress: 0,
          authorised: track.downloadable,
          bytes: { audio: 0, artwork: 0, lyrics: 0, metadata: 0 },
          createdAt: Date.now(),
          hasSyncedLyrics: false,
          hasArtwork: false,
        };
        set((state) => ({
          records: { ...state.records, [track.id]: record },
          order: state.order.includes(track.id) ? state.order : [...state.order, track.id],
          queue: [...state.queue.filter((id) => id !== track.id), track.id],
        }));
        void pump();
      },

      retry: (trackId) => {
        const record = get().records[trackId];
        if (!record) return;
        set((state) => ({
          records: { ...state.records, [trackId]: { ...record, status: "queued", progress: 0, error: undefined } },
          queue: [...state.queue.filter((id) => id !== trackId), trackId],
        }));
        void pump();
      },

      cancel: (trackId) => {
        controllers.get(trackId)?.abort();
        controllers.delete(trackId);
        set((state) => {
          const record = state.records[trackId];
          if (!record) return state;
          const records = { ...state.records };
          delete records[trackId];
          return {
            records,
            queue: state.queue.filter((id) => id !== trackId),
            active: state.active.filter((id) => id !== trackId),
            order: state.order.filter((id) => id !== trackId),
          };
        });
      },

      remove: async (trackId) => {
        controllers.get(trackId)?.abort();
        controllers.delete(trackId);
        const record = get().records[trackId];
        if (record) {
          const artHash = record.track.artwork ? hashUrl(record.track.artwork) : null;
          const shared = Object.entries(get().records).some(
            ([id, other]) =>
              id !== trackId && other.track.artwork && artHash && hashUrl(other.track.artwork) === artHash,
          );
          await idbDel(KEYS.audio(trackId));
          await idbDel(KEYS.lyrics(trackId));
          await idbDel(KEYS.meta(trackId));
          releaseAssetUrl(KEYS.audio(trackId));
          if (artHash && !shared) {
            await idbDel(KEYS.artwork(artHash));
            await idbDel(KEYS.artworkSmall(artHash));
            releaseAssetUrl(KEYS.artwork(artHash));
            releaseAssetUrl(KEYS.artworkSmall(artHash));
          }
        }
        set((state) => {
          const records = { ...state.records };
          delete records[trackId];
          return {
            records,
            order: state.order.filter((id) => id !== trackId),
            queue: state.queue.filter((id) => id !== trackId),
            active: state.active.filter((id) => id !== trackId),
          };
        });
      },

      removeAll: async () => {
        const ids = Object.keys(get().records);
        controllers.forEach((controller) => controller.abort());
        controllers.clear();
        for (const id of ids) {
          await idbDel(KEYS.audio(id));
          await idbDel(KEYS.lyrics(id));
          await idbDel(KEYS.meta(id));
          releaseAssetUrl(KEYS.audio(id));
        }
        const artHashes = new Set(
          Object.values(get().records)
            .map((r) => (r.track.artwork ? hashUrl(r.track.artwork) : null))
            .filter((h): h is string => Boolean(h)),
        );
        for (const hash of artHashes) {
          await idbDel(KEYS.artwork(hash));
          await idbDel(KEYS.artworkSmall(hash));
        }
        set({ records: {}, order: [], queue: [], active: [] });
      },

      recoverInterrupted: () =>
        set((state) => {
          const records: Record<string, DownloadRecord> = {};
          for (const [id, record] of Object.entries(state.records)) {
            records[id] =
              record.status === "downloading"
                ? { ...record, status: "failed", error: "Interrupted — retry to finish", progress: 0 }
                : record;
          }
          return { records, queue: [], active: [] };
        }),
    }),
    {
      name: "melo-downloads",
      version: 1,
      partialize: (state) => ({ records: state.records, order: state.order }),
      onRehydrateStorage: () => (state) => {
        state?.recoverInterrupted();
      },
    },
  ),
);

function updateRecord(trackId: string, patch: Partial<DownloadRecord>) {
  const state = useDownloads.getState();
  const record = state.records[trackId];
  if (!record) return;
  useDownloads.setState({ records: { ...state.records, [trackId]: { ...record, ...patch } } });
}

async function fetchBlob(
  url: string,
  signal: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Download failed (${res.status})`);
  }
  const total = Number(res.headers.get("content-length") || 0);
  const type = res.headers.get("content-type") || "audio/mpeg";
  if (!res.body) {
    const blob = await res.blob();
    onProgress?.(1);
    return blob;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let lastTick = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (onProgress && Date.now() - lastTick > 180) {
        lastTick = Date.now();
        onProgress(total ? Math.min(received / total, 0.999) : 0);
      }
    }
  }
  onProgress?.(1);
  return new Blob(chunks as BlobPart[], { type });
}

async function downloadOne(trackId: string) {
  const state = useDownloads.getState();
  const record = state.records[trackId];
  if (!record || record.status !== "queued") return;
  const track = record.track;
  const controller = new AbortController();
  controllers.set(trackId, controller);

  useDownloads.setState({ active: [...useDownloads.getState().active, trackId] });
  updateRecord(trackId, { status: "downloading", progress: 0, error: undefined });

  try {
    const audioBlob = await fetchBlob(
      `/api/stream/${track.provider}/${encodeURIComponent(track.providerId)}?download=1`,
      controller.signal,
      (fraction) => updateRecord(trackId, { progress: fraction }),
    );
    if (!audioBlob.size) throw new Error("The source returned an empty file");
    const stored = await idbSet(KEYS.audio(trackId), audioBlob);
    if (!stored) throw new Error("Not enough local storage for this track");

    let artworkBytes = 0;
    let hasArtwork = false;
    if (track.artwork) {
      try {
        const artwork = await fetchBlob(`/api/image?src=${encodeURIComponent(track.artwork)}`, controller.signal);
        if (artwork.size) {
          hasArtwork = await idbSet(KEYS.artwork(hashUrl(track.artwork)), artwork);
          artworkBytes = artwork.size;
        }
      } catch {
        // Artwork is optional; audio + metadata still make a valid download.
      }
    }

    let lyricsBytes = 0;
    let hasSyncedLyrics = false;
    try {
      const params = new URLSearchParams({ title: track.title, artist: track.artist });
      if (track.album) params.set("album", track.album);
      if (track.duration) params.set("duration", String(Math.round(track.duration)));
      const res = await fetch(`/api/lyrics?${params.toString()}`, { signal: controller.signal });
      if (res.ok) {
        const payload = (await res.json()) as { lyrics: Lyrics | null };
        if (payload.lyrics) {
          const json = JSON.stringify(payload.lyrics);
          lyricsBytes = new Blob([json]).size;
          hasSyncedLyrics = payload.lyrics.synced;
          await idbSet(KEYS.lyrics(trackId), json);
        }
      }
    } catch {
      // Lyrics can be fetched again later; never fail a download over them.
    }

    const meta = JSON.stringify({
      track: {
        ...track,
        // Artwork now resolves locally too.
        artwork: track.artwork ? `/api/image?src=${encodeURIComponent(track.artwork)}` : undefined,
      },
      artist: { id: track.artistId, name: track.artist },
      collaborators: track.featuredArtists,
      savedAt: new Date().toISOString(),
      source: track.provider,
      authorised: record.authorised,
    });
    const metadataBytes = new Blob([meta]).size;
    await idbSet(KEYS.meta(trackId), meta);

    updateRecord(trackId, {
      status: "complete",
      progress: 1,
      hasSyncedLyrics,
      hasArtwork,
      bytes: {
        audio: audioBlob.size,
        artwork: artworkBytes,
        lyrics: lyricsBytes,
        metadata: metadataBytes,
      },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    updateRecord(trackId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Download failed",
    });
  } finally {
    controllers.delete(trackId);
    useDownloads.setState({ active: useDownloads.getState().active.filter((id) => id !== trackId) });
    void pump();
  }
}

async function pump() {
  const state = useDownloads.getState();
  const capacity = MAX_CONCURRENT - state.active.length;
  if (capacity <= 0) return;
  const next = state.queue.filter((id) => {
    const record = state.records[id];
    return record?.status === "queued" && !state.active.includes(id);
  });
  for (const id of next.slice(0, capacity)) {
    useDownloads.setState({ queue: useDownloads.getState().queue.filter((qid) => qid !== id) });
    void downloadOne(id);
  }
}

/** Offline audio source for a downloaded track. */
export async function offlineTrackUrl(trackId: string): Promise<string | null> {
  return getAssetUrl(KEYS.audio(trackId));
}

export async function cachedLyrics(trackId: string): Promise<Lyrics | null> {
  const raw = await idbGet<string>(KEYS.lyrics(trackId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Lyrics;
  } catch {
    return null;
  }
}
