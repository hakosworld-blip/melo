import { detectSource, parseSpotifyPlaylistId, type ImportSource, type SpotifyTrackRef } from './importing';
import type { Track } from './types';

/**
 * Import flow for the phone.
 *
 * Both Spotify and YouTube playlists go through the melo server: reading a
 * YouTube playlist needs yt-dlp, matching a Spotify song needs the same search
 * index, and that server also serves the audio for what it returns.
 */

export interface ImportResult {
  name: string;
  tracks: Track[];
  missing: string[];
  duplicates: number;
  capped: boolean;
  source: ImportSource;
  viaServer: boolean;
}

export interface ImportProgress {
  phase: 'reading' | 'matching';
  done: number;
  total: number;
}

type Progress = (progress: ImportProgress) => void;

async function postJson<T>(url: string, body: unknown, timeoutMs = 180000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !payload) {
      throw new Error(payload?.error || `The server answered ${res.status}.`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The melo server took too long to answer.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function describe(ref: SpotifyTrackRef) {
  return `${ref.title} — ${ref.artistLine || 'unknown artist'}`;
}

async function importSpotifyViaServer(link: string, serverUrl: string, onProgress: Progress): Promise<ImportResult> {
  onProgress({ phase: 'reading', done: 0, total: 0 });
  const read = await postJson<{ playlist: { name: string; capped: boolean; tracks: SpotifyTrackRef[] } }>(
    `${serverUrl}/api/import/spotify`,
    { url: link },
  );
  const { name, capped, tracks: refs } = read.playlist;
  onProgress({ phase: 'matching', done: 0, total: refs.length });

  const matched: Track[] = [];
  const missing: string[] = [];
  const BATCH = 10;
  for (let index = 0; index < refs.length; index += BATCH) {
    const batch = refs.slice(index, index + BATCH);
    const res = await postJson<{ results: { matched: Track | null }[] }>(`${serverUrl}/api/import/match`, {
      tracks: batch.map((ref) => ({ title: ref.title, artist: ref.artistLine, duration: ref.duration })),
    });
    batch.forEach((ref, position) => {
      const hit = res.results?.[position]?.matched ?? null;
      if (hit) matched.push(hit);
      else missing.push(describe(ref));
    });
    onProgress({ phase: 'matching', done: Math.min(index + BATCH, refs.length), total: refs.length });
  }

  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const track of matched) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
  }
  return { name, tracks, missing, duplicates: matched.length - tracks.length, capped, source: 'spotify', viaServer: true };
}

async function importYoutubeViaServer(link: string, serverUrl: string, onProgress: Progress): Promise<ImportResult> {
  onProgress({ phase: 'reading', done: 0, total: 0 });
  const res = await postJson<{ playlist: { name: string; capped: boolean; tracks: Track[] } }>(
    `${serverUrl}/api/import/youtube`,
    { url: link },
  );
  const { name, capped, tracks } = res.playlist;
  onProgress({ phase: 'reading', done: tracks.length, total: tracks.length });
  return { name, tracks, missing: [], duplicates: 0, capped, source: 'youtube', viaServer: true };
}

export async function importPlaylist(link: string, serverUrl: string, onProgress: Progress): Promise<ImportResult> {
  const source = detectSource(link);
  if (!source) throw new Error('Paste a Spotify or YouTube Music playlist link.');

  if (!serverUrl) {
    throw new Error('Add your melo server in Settings first — melo reads and matches playlists through it.');
  }

  return source === 'youtube'
    ? importYoutubeViaServer(link, serverUrl, onProgress)
    : importSpotifyViaServer(link, serverUrl, onProgress);
}
