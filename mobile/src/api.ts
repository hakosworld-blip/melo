import { getServerUrl } from './settings';
import type { ArtistSummary, HomeSection, SearchResults, Track } from './types';

/**
 * The phone talks to YouTube Music through a melo server.
 *
 * YouTube needs yt-dlp for both metadata and audio, which cannot run inside an
 * app bundle, and melo has exactly one music source now — so every catalogue
 * call comes from the server the user points at in Settings. Without one, the
 * app says so instead of quietly showing an empty catalogue.
 */

export class ServerRequiredError extends Error {
  constructor() {
    super('Add your melo server in Settings — YouTube Music is read through it.');
    this.name = 'ServerRequiredError';
  }
}

export function hasServer() {
  return Boolean(getServerUrl());
}

function serverUrl(): string {
  const url = getServerUrl();
  if (!url) throw new ServerRequiredError();
  return url;
}

async function getJson<T>(path: string, timeoutMs = 25000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${serverUrl()}${path}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok || !payload) throw new Error(payload?.error || `The melo server answered ${res.status}.`);
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The melo server took too long to answer.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface HomePayload {
  provider: string;
  sections: HomeSection[];
  genres: { name: string; artwork?: string }[];
  day: string;
  personalised: boolean;
}

export async function fetchHomeFeed(
  seeds: { artists: string[]; genres: string[] },
  day: string,
): Promise<HomePayload> {
  const params = new URLSearchParams({ provider: 'youtube', day });
  if (seeds.artists.length) params.set('artists', seeds.artists.slice(0, 6).join(','));
  if (seeds.genres.length) params.set('genres', seeds.genres.slice(0, 6).join(','));
  return getJson<HomePayload>(`/api/home?${params.toString()}`);
}

export async function searchCatalogue(query: string, limit = 20): Promise<SearchResults> {
  const term = query.trim();
  if (!term) return { tracks: [], artists: [], albums: [] };
  const params = new URLSearchParams({ provider: 'youtube', q: term, limit: String(limit) });
  return getJson<SearchResults>(`/api/search?${params.toString()}`);
}

/** Tracks only — used by playlist import matching. */
export async function searchTracks(query: string, limit = 12): Promise<Track[]> {
  const results = await searchCatalogue(query, limit).catch(() => ({ tracks: [] as Track[] }));
  return results.tracks.filter((track) => track.streamable);
}

export async function fetchArtistTracks(artistId: string, limit = 25): Promise<Track[]> {
  const nativeId = artistId.includes(':') ? artistId.split(':').slice(1).join(':') : artistId;
  const payload = await getJson<{ artist: { topTracks?: Track[]; latestTracks?: Track[] } | null }>(
    `/api/artist/youtube/${encodeURIComponent(nativeId)}`,
  ).catch(() => ({ artist: null }));
  const artist = payload.artist;
  if (!artist) return [];
  return [...(artist.topTracks ?? []), ...(artist.latestTracks ?? [])].slice(0, limit);
}

/** YouTube Music has no genre catalogue, so there is nothing to browse. */
export async function fetchGenreTracks(_genre: string, _limit = 50): Promise<Track[]> {
  return [];
}

/** Tracks from the first real shelf the server returns. */
export async function fetchTrending(limit = 24): Promise<Track[]> {
  const params = new URLSearchParams({ provider: 'youtube' });
  const payload = await getJson<HomePayload>(`/api/home?${params.toString()}`).catch(() => null);
  if (!payload) return [];
  const shelf = payload.sections.find((section) => section.kind === 'tracks' && (section.items as Track[]).length > 0);
  return ((shelf?.items ?? []) as Track[]).slice(0, limit);
}

export interface ChartArtist {
  name: string;
  rank: number;
  monthlyListeners: number;
  dailyChange: number;
  peakRank: number;
  peakListeners: number;
  worldwide: { position: number; title: string } | null;
}

export async function fetchCharts(limit = 25): Promise<{ source: string; updated: string | null; artists: ChartArtist[] }> {
  return getJson<{ source: string; updated: string | null; artists: ChartArtist[] }>(`/api/charts/top?limit=${limit}`);
}

export function canStream(track: Track) {
  return track.streamable && hasServer();
}

export function streamUrl(track: Track): string {
  if (track.provider !== 'youtube') return '';
  const server = getServerUrl();
  if (!server) return '';
  return `${server}/api/stream/youtube/${encodeURIComponent(track.providerId)}`;
}

export type { ArtistSummary, HomeSection, SearchResults, Track };
