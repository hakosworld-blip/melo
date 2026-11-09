import type { Track } from './types';

/**
 * Lyrics from LRCLIB — the same community source the web build uses.
 * Synced lyrics are only claimed when the record actually carries timestamps;
 * otherwise the plain text is shown and labelled as not time-synced.
 */

export interface LyricLine {
  time: number;
  text: string;
}

export interface Lyrics {
  synced: boolean;
  lines: LyricLine[];
  instrumental: boolean;
}

interface LrclibRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  instrumental?: boolean;
}

const BASE = 'https://lrclib.net/api';

function cleanTitle(title: string) {
  return title
    .replace(/\((?:feat|ft|with)\.?[^)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s*-\s*(?:remaster(?:ed)?|radio edit|single version|album version).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of raw.split('\n')) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = row.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;
    for (const stamp of stamps) {
      const seconds = Number(stamp[1]) * 60 + Number(stamp[2].replace(':', '.'));
      if (!Number.isFinite(seconds)) continue;
      lines.push({ time: seconds, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`LRCLIB answered ${res.status}.`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function toLyrics(record: LrclibRecord): Lyrics | null {
  if (record.instrumental) return { synced: false, lines: [], instrumental: true };
  const synced = record.syncedLyrics ? parseLrc(record.syncedLyrics) : [];
  if (synced.length) return { synced: true, lines: synced, instrumental: false };
  const plain = (record.plainLyrics || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (plain.length) {
    return { synced: false, lines: plain.map((text) => ({ time: 0, text })), instrumental: false };
  }
  return null;
}

export async function loadLyrics(track: Track): Promise<Lyrics | null> {
  const title = cleanTitle(track.title);
  const params = new URLSearchParams({ track_name: title, artist_name: track.artist });
  if (track.album) params.set('album_name', track.album);
  if (track.duration) params.set('duration', String(Math.round(track.duration)));

  if (track.album && track.duration) {
    const exact = (await getJson(`${BASE}/get?${params}`).catch(() => null)) as LrclibRecord | null;
    const lyrics = exact ? toLyrics(exact) : null;
    if (lyrics) return lyrics;
  }

  const search = (await getJson(
    `${BASE}/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(track.artist)}`,
  ).catch(() => null)) as LrclibRecord[] | null;

  if (Array.isArray(search)) {
    for (const record of search) {
      const lyrics = toLyrics(record);
      if (lyrics) return lyrics;
    }
  }
  return null;
}
