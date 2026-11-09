/**
 * Pure helpers behind playlist import on the phone: reading a pasted link,
 * pulling a public Spotify playlist out of its embed page, and scoring a
 * catalogue search hit against an imported song.
 *
 * No React Native imports here on purpose — these are the parts worth testing
 * outside a device. The scoring rules mirror `lib/match-import.ts` in the web
 * app so both clients pick the same track for the same song.
 */

import type { Track } from './types';

export type ImportSource = 'spotify' | 'youtube';

export interface SpotifyTrackRef {
  title: string;
  artistLine: string;
  /** Seconds; 0 when Spotify doesn't report one. */
  duration: number;
}

export interface ParsedSpotifyPlaylist {
  id: string;
  name: string;
  owner?: string;
  tracks: SpotifyTrackRef[];
  /** Spotify's public page only exposes the first 100 tracks. */
  capped: boolean;
}

const EMBED_CAP = 100;
const MATCH_THRESHOLD = 55;

export function detectSource(input: string): ImportSource | null {
  if (/youtu\.?be|youtube\.com/i.test(input)) return 'youtube';
  if (/spotify/i.test(input)) return 'spotify';
  return null;
}

export function parseSpotifyPlaylistId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const uri = value.match(/^spotify:playlist:([A-Za-z0-9]{10,})$/);
  if (uri) return uri[1];
  const url = value.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/([A-Za-z0-9]{10,})/i);
  if (url) return url[1];
  if (/^[A-Za-z0-9]{22}$/.test(value)) return value;
  return null;
}

export function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\((?:feat|ft|with)\.?[^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE = new Set([
  'feat',
  'ft',
  'featuring',
  'with',
  'the',
  'a',
  'and',
  'remaster',
  'remastered',
  'version',
  'edit',
  'radio',
  'mix',
  'extended',
  'original',
  'single',
  'album',
  'explicit',
  'clean',
  'deluxe',
]);

function tokenSet(value: string) {
  return new Set(
    normalise(value)
      .split(' ')
      .filter((token) => token && !NOISE.has(token)),
  );
}

function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function titleScore(wanted: string, candidate: string) {
  const a = normalise(wanted);
  const b = normalise(candidate);
  if (!a || !b) return 0;
  if (a === b) return 55;
  if (b.startsWith(a) || a.startsWith(b)) return 42;
  if (b.includes(a) || a.includes(b)) return 34;
  return overlap(tokenSet(wanted), tokenSet(candidate)) * 38;
}

function artistScore(wanted: string, candidate: string) {
  const a = normalise(wanted);
  const b = normalise(candidate);
  if (!a || !b) return 0;
  if (a === b) return 32;
  if (b.includes(a) || a.includes(b)) return 24;
  return overlap(tokenSet(wanted), tokenSet(candidate)) * 22;
}

function durationScore(wanted: number, candidate: number) {
  if (!wanted || !candidate) return 0;
  const diff = Math.abs(wanted - candidate);
  if (diff <= 2) return 13;
  if (diff <= 5) return 10;
  if (diff <= 12) return 6;
  if (diff <= 30) return 2;
  if (diff > 75) return -14;
  return 0;
}

export interface MatchQuery {
  title: string;
  artist: string;
  duration?: number;
}

export function scoreCandidate(query: MatchQuery, candidate: Track) {
  const score =
    titleScore(query.title, candidate.title) +
    artistScore(query.artist, candidate.artist) +
    durationScore(query.duration ?? 0, candidate.duration);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function pickBestMatch(query: MatchQuery, candidates: Track[]): Track | null {
  let best: Track | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate.streamable) continue;
    const score = scoreCandidate(query, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

interface EmbedTrack {
  title?: string;
  subtitle?: string;
  duration?: number;
  entityType?: string;
}

function cleanArtistLine(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Reads the JSON Spotify ships inside its public embed page. Throws a readable error. */
export function parseSpotifyEmbed(html: string, id = ''): ParsedSpotifyPlaylist {
  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error('Spotify did not return a readable playlist. Check the link is public.');

  let entity: { type?: string; title?: string; name?: string; subtitle?: string; trackList?: EmbedTrack[] } | undefined;
  try {
    const data = JSON.parse(json) as {
      props?: { pageProps?: { state?: { data?: { entity?: typeof entity } } } };
    };
    entity = data.props?.pageProps?.state?.data?.entity;
  } catch {
    throw new Error('Spotify returned data melo could not read.');
  }

  if (!entity || (entity.type && entity.type !== 'playlist')) throw new Error('That link is not a playlist.');

  const name = (entity.title || entity.name || '').trim();
  if (!name) throw new Error('Spotify did not include the playlist name.');

  const tracks: SpotifyTrackRef[] = [];
  for (const entry of entity.trackList ?? []) {
    if (entry.entityType && entry.entityType !== 'track') continue;
    const title = entry.title?.trim();
    if (!title) continue;
    tracks.push({
      title,
      artistLine: cleanArtistLine(entry.subtitle ?? ''),
      duration: entry.duration && entry.duration > 0 ? Math.round(entry.duration / 1000) : 0,
    });
  }

  if (!tracks.length) throw new Error('This playlist has no tracks melo can read.');

  return {
    id,
    name,
    owner: entity.subtitle && entity.subtitle !== name ? cleanArtistLine(entity.subtitle) : undefined,
    tracks,
    capped: tracks.length >= EMBED_CAP,
  };
}
