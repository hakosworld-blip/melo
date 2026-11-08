import { cached } from "@/lib/cache";
import { fetchJson, normalise } from "@/lib/http";
import type { Lyrics, LyricsLine } from "@/lib/types";

/**
 * LRCLIB — free, open, community lyrics with time-synced LRC when available.
 * https://lrclib.net/docs
 *
 * melo never invents lyrics and never fakes synchronisation: if the matched
 * record has no timestamps we return `synced: false` and the UI says so.
 */

const BASE = process.env.LRCLIB_BASE || "https://lrclib.net/api";

interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function parseLrc(lrc: string): { lines: LyricsLine[]; offset: number } {
  let offset = 0;
  const lines: LyricsLine[] = [];
  for (const rawLine of lrc.split(/\r?\n/)) {
    const meta = rawLine.match(/^\[(offset|ar|ti|al|by|length):(.*)\]$/i);
    if (meta) {
      if (meta[1].toLowerCase() === "offset") {
        const parsed = Number(meta[2]);
        if (Number.isFinite(parsed)) offset = parsed / 1000;
      }
      continue;
    }
    // Word-level (enhanced LRC) tags.
    const words: { t: number; w: string }[] = [];
    const wordRe = /<(\d{1,2}):(\d{2}(?:\.\d{1,3})?)>/g;
    let wm: RegExpExecArray | null;
    while ((wm = wordRe.exec(rawLine))) {
      const t = Number(wm[1]) * 60 + Number(wm[2]);
      const rest = rawLine.slice(wm.index + wm[0].length);
      const nextTag = rest.search(/<\d{1,2}:\d{2}(?:\.\d{1,3})?>/);
      const text = (nextTag === -1 ? rest : rest.slice(0, nextTag)).trim();
      if (text) words.push({ t, w: text });
    }

    const timeRe = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = timeRe.exec(rawLine))) {
      stamps.push(Number(m[1]) * 60 + Number(m[2]));
    }
    if (!stamps.length) continue;
    const text = rawLine.replace(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g, "").replace(/<[^>]+>/g, "").trim();
    for (const stamp of stamps) {
      lines.push({
        time: Math.max(0, stamp + offset),
        text,
        words: words.length ? words.map((w) => ({ ...w, t: Math.max(0, w.t + offset) })) : undefined,
      });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  // Drop exact duplicates that some LRC files contain.
  const deduped = lines.filter((line, i) => i === 0 || line.time !== lines[i - 1].time || line.text !== lines[i - 1].text);
  return { lines: deduped, offset };
}

function toLyrics(record: LrclibRecord): Lyrics {
  const instrumental = Boolean(record.instrumental) || /^\[instrumental\]/i.test((record.plainLyrics || "").trim());
  const parsed = record.syncedLyrics ? parseLrc(record.syncedLyrics) : { lines: [], offset: 0 };
  const synced = parsed.lines.length > 1;
  const plain = (record.plainLyrics || (record.syncedLyrics || "").replace(/\[[^\]]*\]/g, "")).trim();
  const lines = synced
    ? parsed.lines
    : plain
        .split(/\r?\n/)
        .map((text, i) => ({ time: i, text }))
        .filter((l) => l.text !== undefined);
  return {
    synced,
    lines: instrumental ? [] : lines,
    plain,
    instrumental,
    trackName: record.trackName,
    artistName: record.artistName,
    albumName: record.albumName,
    duration: record.duration,
    lrclibId: record.id,
  };
}

function score(record: LrclibRecord, title: string, artist: string, duration?: number) {
  const t = normalise(record.trackName);
  const target = normalise(title);
  let s = 0;
  if (t === target) s += 60;
  else if (t.includes(target) || target.includes(t)) s += 40;
  else {
    const targetWords = new Set(target.split(" ").filter((w) => w.length > 2));
    const shared = t.split(" ").filter((w) => targetWords.has(w)).length;
    s += Math.min(24, shared * 6);
  }
  const a = normalise(record.artistName);
  const artistTarget = normalise(artist);
  if (a && artistTarget) {
    if (a === artistTarget) s += 30;
    else if (a.includes(artistTarget) || artistTarget.includes(a)) s += 20;
  }
  if (duration && record.duration) {
    const delta = Math.abs(record.duration - duration);
    if (delta <= 2) s += 14;
    else if (delta <= 5) s += 8;
    else if (delta > 20) s -= 10;
  }
  if (record.syncedLyrics) s += 6;
  return s;
}

export interface LyricsQuery {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
}

const TTL = 1000 * 60 * 60 * 6;

/** Exact lookup first, then a scored search fallback. */
export async function findLyrics({ title, artist, album, duration }: LyricsQuery): Promise<Lyrics | null> {
  if (!title?.trim()) return null;
  const key = `lyrics:${normalise(title)}|${normalise(artist)}|${Math.round(duration || 0)}`;
  return cached(key, TTL, async () => {
    const params = new URLSearchParams({ track_name: title, artist_name: artist });
    if (album) params.set("album_name", album);
    if (duration && duration > 5) params.set("duration", String(Math.round(duration)));
    try {
      const exact = await fetchJson<LrclibRecord>(`${BASE}/get?${params.toString()}`, { timeout: 8000, retries: 0 });
      if (exact?.id) return toLyrics(exact);
    } catch {
      /* 404 = no exact match; fall through to search */
    }

    const searchParams = new URLSearchParams({ track_name: title });
    if (artist) searchParams.set("artist_name", artist);
    let results: LrclibRecord[] = [];
    try {
      results = await fetchJson<LrclibRecord[]>(`${BASE}/search?${searchParams.toString()}`, { timeout: 9000 });
    } catch {
      results = [];
    }
    if (!results.length) {
      try {
        results = await fetchJson<LrclibRecord[]>(
          `${BASE}/search?q=${encodeURIComponent(`${title} ${artist}`.trim())}`,
          { timeout: 9000 },
        );
      } catch {
        results = [];
      }
    }
    if (!results.length) return null;
    const ranked = results
      .map((r) => ({ r, s: score(r, title, artist, duration) }))
      .sort((a, b) => b.s - a.s);
    const best = ranked[0];
    // Reject wild mismatches instead of showing the wrong song's lyrics.
    if (!best || best.s < 30) return null;
    return toLyrics(best.r);
  });
}

/** Manual lyrics search, used when automatic matching finds nothing. */
export async function searchLyrics(query: string): Promise<Lyrics[]> {
  const term = query.trim();
  if (!term) return [];
  return cached(`lyrics:search:${normalise(term)}`, TTL, async () => {
    try {
      const results = await fetchJson<LrclibRecord[]>(`${BASE}/search?q=${encodeURIComponent(term)}`, {
        timeout: 9000,
      });
      return results.slice(0, 20).map(toLyrics);
    } catch {
      return [];
    }
  });
}
