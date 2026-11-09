import { searchTracks } from './api';
import {
  detectSource,
  parseSpotifyEmbed,
  parseSpotifyPlaylistId,
  pickBestMatch,
  type ImportSource,
  type ParsedSpotifyPlaylist,
  type SpotifyTrackRef,
} from './importing';
import type { Track } from './types';

/**
 * Import flow for the phone.
 *
 * Spotify is read and matched entirely on the device: the public embed page
 * gives the playlist, and each song is searched in Audius. YouTube playlists
 * have no on-device path — reading one needs yt-dlp — so they go through an
 * optional melo server on the same network, which also serves the audio for the
 * songs it returns.
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

const SPOTIFY_EMBED = 'https://open.spotify.com/embed/playlist/';
const DEVICE_BATCH = 6;

async function fetchSpotifyPlaylist(id: string): Promise<ParsedSpotifyPlaylist> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${SPOTIFY_EMBED}${id}`, {
      signal: controller.signal,
      headers: { accept: 'text/html', 'accept-language': 'en' },
    });
    if (res.status === 404) throw new Error('That Spotify playlist does not exist or is not public.');
    if (!res.ok) throw new Error(`Spotify responded ${res.status}.`);
    return parseSpotifyEmbed(await res.text(), id);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Spotify took too long to answer.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

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

async function matchOnDevice(playlist: ParsedSpotifyPlaylist, onProgress: Progress) {
  const matched: Track[] = [];
  const missing: string[] = [];
  for (let index = 0; index < playlist.tracks.length; index += DEVICE_BATCH) {
    const batch = playlist.tracks.slice(index, index + DEVICE_BATCH);
    const hits = await Promise.all(
      batch.map(async (ref) => {
        const query = `${ref.title} ${ref.artistLine}`.trim();
        const candidates = await searchTracks(query, 8).catch(() => [] as Track[]);
        return pickBestMatch({ title: ref.title, artist: ref.artistLine, duration: ref.duration }, candidates);
      }),
    );
    batch.forEach((ref, position) => {
      const hit = hits[position];
      if (hit) matched.push(hit);
      else missing.push(describe(ref));
    });
    onProgress({ phase: 'matching', done: Math.min(index + DEVICE_BATCH, playlist.tracks.length), total: playlist.tracks.length });
  }
  return { matched, missing };
}

async function importSpotifyOnDevice(link: string, onProgress: Progress): Promise<ImportResult> {
  const id = parseSpotifyPlaylistId(link);
  if (!id) throw new Error('That is not a Spotify playlist link. Copy it with Share → Copy link to playlist.');
  onProgress({ phase: 'reading', done: 0, total: 0 });
  const playlist = await fetchSpotifyPlaylist(id);
  onProgress({ phase: 'matching', done: 0, total: playlist.tracks.length });
  const { matched, missing } = await matchOnDevice(playlist, onProgress);
  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const track of matched) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
  }
  return {
    name: playlist.name,
    tracks,
    missing,
    duplicates: matched.length - tracks.length,
    capped: playlist.capped,
    source: 'spotify',
    viaServer: false,
  };
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

  if (source === 'youtube') {
    if (!serverUrl) {
      throw new Error(
        'YouTube playlists need a melo server on this network — reading one requires yt-dlp. Add your server address in Settings, or import a Spotify playlist instead.',
      );
    }
    return importYoutubeViaServer(link, serverUrl, onProgress);
  }

  return serverUrl ? importSpotifyViaServer(link, serverUrl, onProgress) : importSpotifyOnDevice(link, onProgress);
}
