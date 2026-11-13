import type { AlbumSummary, ArtistSummary, GenreSummary, HomeSection, MusicProvider, Track } from "@/lib/types";

/**
 * Home feed.
 *
 * There is no account, so "for you" means the plays this device has recorded.
 * The listener's top artists and genres are sent up as seeds; the mix is drawn
 * from those artists' real catalogues plus the genres they actually play, and
 * every section is ordered by a seed derived from the calendar day. The same
 * day gives the same mix, tomorrow gives a different one — so "daily" is a
 * promise the data can keep rather than a label on a static list.
 *
 * Nothing is invented: every row is filtered from music the provider returned.
 */

export interface TasteSeeds {
  /** Unified artist ids (`youtube:<id>`), most played first. */
  artists: string[];
  /** Genre names, most played first. */
  genres: string[];
}

export interface HomeFeed {
  sections: HomeSection[];
  genres: GenreSummary[];
  day: string;
  /** True when the mix was built from this device's taste, false when it is a rotating shelf. */
  personalised: boolean;
}

export function dayKey(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG so a day's mix survives a refresh. */
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
  for (let i = out.length - 1; i > 0; i--) {
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
    if (!track.artist || track.artist === "Unknown artist") continue;
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

export async function buildHomeFeed(
  provider: MusicProvider,
  options: { day?: string; seeds?: TasteSeeds } = {},
): Promise<HomeFeed> {
  const day = options.day && /^\d{4}-\d{2}-\d{2}$/.test(options.day) ? options.day : dayKey();
  const seeds = options.seeds;
  const hasTaste = Boolean(seeds && (seeds.artists.length || seeds.genres.length));

  const basePromise = provider.home();
  const genrePromise = provider.genres ? provider.genres().catch(() => [] as GenreSummary[]) : Promise.resolve([] as GenreSummary[]);

  let base: HomeSection[] = [];
  let baseError: unknown = null;
  try {
    base = await basePromise;
  } catch (err) {
    baseError = err;
  }

  const genres = await genrePromise;
  if (!base.length && !hasTaste) {
    throw baseError instanceof Error ? baseError : new Error("The music source returned nothing");
  }

  // Every shelf the source returned feeds the mix, not just a "trending" id:
  // filtering by id here emptied Home whenever the source used its own ids.
  const baseTracks = base
    .filter((section) => section.kind === "tracks")
    .flatMap((section) => section.items as Track[]);

  // --- taste pools -------------------------------------------------------
  const artistIds = (seeds?.artists ?? []).slice(0, 4);
  const artistPools = await Promise.all(
    artistIds.map((id) => provider.artistTracks?.(id, 12).catch(() => [] as Track[]) ?? Promise.resolve([] as Track[])),
  );
  const genreNames = (seeds?.genres ?? []).slice(0, 2);
  const genrePools = await Promise.all(
    genreNames.map((name) => provider.genreTracks?.(name, 24).catch(() => [] as Track[]) ?? Promise.resolve([] as Track[])),
  );

  const tastePool = dedupe([...artistPools.flat(), ...genrePools.flat()]);
  const seedKey = `${day}:${artistIds.join(",")}:${genreNames.join(",")}`;

  let mix: Track[];
  if (tastePool.length >= 10) {
    mix = seededShuffle(tastePool, `${seedKey}:mix`).slice(0, 30);
  } else if (baseTracks.length) {
    mix = seededShuffle(baseTracks, `${seedKey}:fallback`).slice(0, 24);
  } else {
    mix = seededShuffle(tastePool, `${seedKey}:fallback`).slice(0, 24);
  }

  // Widen the day-to-day change: a slice of the catalogue outside the usual taste.
  const otherGenres = (genres.length ? genres.map((g) => g.name) : ["Electronic", "Lo-Fi", "Pop", "House"]).filter(
    (name) => !genreNames.some((played) => played.toLowerCase() === name.toLowerCase()),
  );
  const wideGenre = seededShuffle(otherGenres, `${seedKey}:genre`)[0];
  const widePool = wideGenre
    ? await (provider.genreTracks?.(wideGenre, 18).catch(() => [] as Track[]) ?? Promise.resolve([] as Track[]))
    : [];

  const sections: HomeSection[] = [];

  sections.push({
    id: "daily-mix",
    title: hasTaste ? "Made for you" : "Today's mix",
    subtitle: hasTaste
      ? "The artists and genres you play here, reshuffled every day"
      : "A fresh set from across the catalogue, every day",
    kind: "tracks",
    items: mix,
  });

  // "More from" rows, one per seed artist that actually returns music.
  const named = artistPools
    .map((pool) => pool[0])
    .filter((track): track is Track => Boolean(track?.artist));
  named.slice(0, 2).forEach((track, index) => {
    const pool = dedupe([track, ...(artistPools[index] ?? [])]).filter((t) => t.artistId === track.artistId);
    if (pool.length < 4) return;
    sections.push({
      id: `more-from-${index}-${track.artistId}`,
      title: `More from ${track.artist}`,
      subtitle: "Because you keep coming back to them",
      kind: "tracks",
      items: seededShuffle(pool, `${seedKey}:artist:${index}`).slice(0, 16),
    });
  });

  const wideTracks = seededShuffle(dedupe(widePool), `${seedKey}:wide`).slice(0, 16);
  if (wideTracks.length >= 6) {
    sections.push({
      id: "wider-listening",
      title: wideGenre ? `${wideGenre}, for a change` : "Wider listening",
      subtitle: hasTaste ? "A corner you haven't played here" : "Something outside the usual rotation",
      kind: "tracks",
      items: wideTracks,
    });
  }

  const mixArtists = artistRow(mix);
  if (mixArtists.length >= 4) {
    sections.push({
      id: "mix-artists",
      title: "Artists in this mix",
      subtitle: "Every name is on one of today's songs",
      kind: "artists",
      items: mixArtists,
    });
  }

  const mixAlbums = albumRow([...mix, ...wideTracks]);
  if (mixAlbums.length >= 4) {
    sections.push({
      id: "mix-albums",
      title: "Albums in this mix",
      subtitle: "Full releases behind today's songs",
      kind: "albums",
      items: mixAlbums,
    });
  }

  // Keep the source's own shelves after the mix. Earlier only a section called
  // "trending" survived, so a source whose rows used other ids — YouTube Music
  // uses hits/chill/focus/throwback — arrived on Home as nothing at all.
  for (const section of base) {
    if (section.id === "trending") {
      sections.push({ ...section, title: "Popular right now", subtitle: "What the community is playing this week" });
    } else if (section.id === "artists" && mixArtists.length < 4) {
      sections.push(section);
    } else if (section.kind === "albums" || section.kind === "tracks" || section.kind === "artists") {
      if (section.items.length >= 4) sections.push(section);
    }
  }

  if (genres.length && provider.genreTracks) {
    const spotlight = seededShuffle(
      genres.filter((genre) => genre.name !== wideGenre),
      `${seedKey}:spotlight`,
    ).slice(0, 2);
    for (const genre of spotlight) {
      const tracks = await provider.genreTracks(genre.name, 14).catch(() => [] as Track[]);
      if (tracks.length >= 6) {
        sections.push({
          id: `spotlight-${genre.name}`,
          title: genre.name,
          subtitle: `Popular ${genre.name.toLowerCase()} this week`,
          kind: "tracks",
          items: tracks,
        });
      }
    }
  }

  return { sections, genres, day, personalised: hasTaste };
}
