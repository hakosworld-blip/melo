import { fetchHomeFeed } from './api';
import { useLibrary } from './library';
import type { HomeSection, Track } from './types';

/**
 * Home feed for the phone.
 *
 * The server builds the shelves (YouTube searches, plus this device's taste as
 * seeds); the phone only decides what to show. "For you" still means the plays
 * this phone recorded — nothing else can honestly claim that without an account.
 */

export interface HomeFeed {
  sections: HomeSection[];
  mix: Track[];
  genreTiles: { name: string; artwork?: string }[];
  personalised: boolean;
  day: string;
}

export function dayKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Seeds come from what this phone has played, most recent first. */
export function tasteSeeds() {
  const recent = useLibrary.getState().recent;
  const artistScore = new Map<string, number>();
  const genreScore = new Map<string, number>();
  recent.forEach((track, index) => {
    const weight = recent.length - index;
    if (track.artistId) artistScore.set(track.artistId, (artistScore.get(track.artistId) ?? 0) + weight);
    if (track.genre) genreScore.set(track.genre, (genreScore.get(track.genre) ?? 0) + weight);
  });
  const artists = [...artistScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 4);
  const genres = [...genreScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre)
    .slice(0, 3);
  return { artists, genres };
}

/** One feed per day keeps a refresh from reshuffling what is already on screen. */
let cache: { key: string; at: number; feed: HomeFeed } | null = null;

export async function buildHomeFeed(force = false): Promise<HomeFeed> {
  const day = dayKey();
  const seeds = tasteSeeds();
  const key = `${day}:${seeds.artists.join(',')}:${seeds.genres.join(',')}`;
  if (!force && cache && cache.key === key && Date.now() - cache.at < 5 * 60_000) return cache.feed;

  const payload = await fetchHomeFeed(seeds, day);
  const sections = payload.sections ?? [];
  const mix = (sections.find((section) => section.id === 'daily-mix')?.items ?? []) as Track[];
  const feed: HomeFeed = {
    sections,
    mix,
    genreTiles: (payload.genres ?? []).map((genre) => ({ name: genre.name, artwork: genre.artwork })),
    personalised: Boolean(payload.personalised),
    day: payload.day || day,
  };
  cache = { key, at: Date.now(), feed };
  return feed;
}
