import { fetchArtistTracks, fetchGenreTiles, fetchGenreTracks, fetchTrending, GENRES } from './api';
import { useLibrary } from './library';
import type { AlbumSummary, ArtistSummary, HomeSection, Track } from './types';

/**
 * Home feed for the phone.
 *
 * There is no account, so "for you" can only mean the plays this device has
 * recorded. The recent list supplies the seed artists and genres; the mix is
 * drawn from those artists' real catalogues plus the genres actually played,
 * and ordered by a seed derived from the calendar day. The same day gives the
 * same mix and tomorrow gives a different one, which is the only honest way to
 * ship a "daily" shelf without a server.
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

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const random = mulberry32(hashString(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dedupe(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const track of tracks) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    out.push(track);
  }
  return out;
}

function artistRow(tracks: Track[], limit = 12): ArtistSummary[] {
  const seen = new Map<string, ArtistSummary>();
  for (const track of tracks) {
    if (!track.artistId || seen.has(track.artistId)) continue;
    if (!track.artist || track.artist === 'Unknown artist') continue;
    seen.set(track.artistId, {
      id: track.artistId,
      provider: track.provider,
      providerId: track.providerId,
      name: track.artist,
      artwork: track.artistArtwork || track.artworkSmall,
    });
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
}

function albumRow(tracks: Track[], limit = 14): AlbumSummary[] {
  const seen = new Map<string, AlbumSummary>();
  for (const track of tracks) {
    if (!track.albumId || !track.album || seen.has(track.albumId)) continue;
    seen.set(track.albumId, {
      id: track.albumId,
      provider: track.provider,
      providerId: track.albumId,
      name: track.album,
      artist: track.artist,
      artistId: track.artistId,
      artwork: track.artwork,
    });
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
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
  const artists = [...artistScore.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 4);
  const genres = [...genreScore.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre).slice(0, 3);
  return { artists, genres };
}

/** One feed per day keeps a refresh from reshuffling what is already on screen. */
let cache: { key: string; at: number; feed: HomeFeed } | null = null;

export async function buildHomeFeed(force = false): Promise<HomeFeed> {
  const day = dayKey();
  const seeds = tasteSeeds();
  const key = `${day}:${seeds.artists.join(',')}:${seeds.genres.join(',')}`;
  if (!force && cache && cache.key === key && Date.now() - cache.at < 5 * 60_000) return cache.feed;

  const personalised = seeds.artists.length > 0 || seeds.genres.length > 0;

  const trendingPromise = fetchTrending(24).catch(() => [] as Track[]);
  // Tiles need one cover each; start those requests now and collect them later.
  const tilesPromise = fetchGenreTiles().catch(() => [] as { name: string; artwork?: string }[]);
  const artistPoolsPromise = Promise.all(
    seeds.artists.map((id) => fetchArtistTracks(id, 12).catch(() => [] as Track[])),
  );
  const genrePoolsPromise = Promise.all(
    seeds.genres.slice(0, 2).map((name) => fetchGenreTracks(name, 24).catch(() => [] as Track[])),
  );

  const [trending, artistPools, genrePools] = await Promise.all([
    trendingPromise,
    artistPoolsPromise,
    genrePoolsPromise,
  ]);

  const tastePool = dedupe([...artistPools.flat(), ...genrePools.flat()]);
  const seedKey = `${day}:${seeds.artists.join(',')}:${seeds.genres.join(',')}`;

  const mix = tastePool.length >= 10
    ? seededShuffle(tastePool, `${seedKey}:mix`).slice(0, 30)
    : trending.length
      ? seededShuffle(trending, `${seedKey}:fallback`).slice(0, 24)
      : seededShuffle(tastePool, `${seedKey}:fallback`).slice(0, 24);

  const sections: HomeSection[] = [
    {
      id: 'daily-mix',
      title: personalised ? 'Made for you' : "Today's mix",
      subtitle: personalised
        ? 'The artists and genres you play here, reshuffled every day'
        : 'A fresh set from across the catalogue, every day',
      kind: 'tracks',
      items: mix,
    },
  ];

  // "More from" rows, one per seed artist that returned real music.
  artistPools.slice(0, 2).forEach((pool, index) => {
    const anchor = pool[0];
    if (!anchor?.artistId || pool.length < 4) return;
    const own = dedupe(pool).filter((track) => track.artistId === anchor.artistId);
    if (own.length < 4) return;
    sections.push({
      id: `more-from-${index}`,
      title: `More from ${anchor.artist}`,
      subtitle: 'Because you keep coming back to them',
      kind: 'tracks',
      items: seededShuffle(own, `${seedKey}:artist:${index}`).slice(0, 16),
    });
  });

  // A corner of the catalogue outside the usual taste, so the page can change.
  const otherGenres = GENRES.filter((name) => !seeds.genres.some((played) => played.toLowerCase() === name.toLowerCase()));
  const wideGenre = seededShuffle(otherGenres, `${seedKey}:genre`)[0];
  if (wideGenre) {
    const wide = await fetchGenreTracks(wideGenre, 18).catch(() => [] as Track[]);
    const items = seededShuffle(dedupe(wide), `${seedKey}:wide`).slice(0, 16);
    if (items.length >= 6) {
      sections.push({
        id: `wider-${wideGenre}`,
        title: `${wideGenre}, for a change`,
        subtitle: "A corner you haven't played here",
        kind: 'tracks',
        items,
      });
    }
  }

  const mixArtists = artistRow(mix);
  if (mixArtists.length >= 4) {
    sections.push({
      id: 'mix-artists',
      title: 'Artists in this mix',
      subtitle: "Every name is on one of today's songs",
      kind: 'artists',
      items: mixArtists,
    });
  }

  const mixAlbums = albumRow(mix);
  if (mixAlbums.length >= 3) {
    sections.push({
      id: 'mix-albums',
      title: 'Albums in this mix',
      subtitle: "Full releases behind today's songs",
      kind: 'albums',
      items: mixAlbums,
    });
  }

  if (trending.length) {
    sections.push({
      id: 'trending',
      title: 'Popular right now',
      subtitle: 'What the community is playing this week',
      kind: 'tracks',
      items: trending,
    });
  }

  const genreTiles = await tilesPromise;
  const feed: HomeFeed = { sections, mix, genreTiles, personalised, day };
  cache = { key, at: Date.now(), feed };
  return feed;
}
