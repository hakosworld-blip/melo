import { cached } from "@/lib/cache";
import { fetchJson, UpstreamError } from "@/lib/http";
import type {
  Album,
  AlbumSummary,
  Artist,
  ArtistSummary,
  GenreSummary,
  HomeSection,
  MusicProvider,
  ProviderAvailability,
  SearchResults,
  Track,
} from "@/lib/types";

/**
 * Audius provider — a genuinely free, keyless streaming catalogue.
 *
 * Audius publishes its public API for apps and serves full-length streams,
 * real play counts, artist bios, albums, playlists and explicit download
 * permissions (`is_downloadable`). We respect every one of those flags:
 * stream-gated tracks are never played, and "download" is only offered when
 * the artist enabled it (other tracks can still be saved as a private offline
 * copy, clearly labelled as such in the UI).
 */

const BASE = process.env.AUDIUS_API_BASE || "https://api.audius.co/v1";
const APP = "melo";

function q(extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams({ app_name: APP });
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  return params.toString();
}

type AudiusArt = Record<string, string> | undefined | null;

function pickArt(art: AudiusArt, size: "150x150" | "480x480" | "1000x1000" = "1000x1000") {
  if (!art) return undefined;
  return art[size] || art["480x480"] || art["1000x1000"] || art["150x150"];
}

interface AudiusUser {
  id: string;
  name: string;
  handle: string;
  bio?: string | null;
  location?: string | null;
  follower_count?: number;
  track_count?: number;
  album_count?: number;
  playlist_count?: number;
  verified?: boolean;
  is_verified?: boolean;
  profile_picture?: AudiusArt;
  cover_photo?: AudiusArt;
}

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  mood?: string;
  play_count?: number;
  release_date?: string;
  created_at?: string;
  artwork?: AudiusArt;
  user?: AudiusUser;
  user_id?: string;
  artists?: { id: string; name: string; handle?: string }[];
  permalink?: string;
  is_downloadable?: boolean;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_available?: boolean;
  album_backlink?: { playlist_id?: string; playlist_name?: string } | null;
  remix_of?: { tracks?: { parent_track_id?: string }[] } | null;
}

interface AudiusPlaylist {
  id: string;
  playlist_name: string;
  description?: string | null;
  is_album?: boolean;
  track_count?: number;
  total_play_count?: number;
  artwork?: AudiusArt;
  user?: AudiusUser;
  permalink?: string;
  release_date?: string;
  created_at?: string;
  playlist_contents?: { track_id: string; timestamp?: string }[];
}

interface ListResponse<T> {
  data: T[];
}

interface SingleResponse<T> {
  data: T;
}

/** Audius returns a bare list for collection endpoints and a single object for detail endpoints. */
function firstOf<T>(payload: ListResponse<T> | SingleResponse<T> | null | undefined): T | null {
  if (!payload || payload.data === undefined || payload.data === null) return null;
  return Array.isArray(payload.data) ? payload.data[0] ?? null : (payload.data as T);
}

function parseFeatured(title: string): string[] {
  // Only real credits that the source puts in the title. Nothing invented.
  const out: string[] = [];
  const re = /(?:feat\.?|ft\.?|featuring|with)\s+([^()[\]]+?)(?:[)\]]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title))) {
    const chunk = m[1].trim();
    if (chunk) {
      chunk
        .split(/,|&|\band\b/i)
        .map((s) => s.trim())
        .filter((s) => s && s.length < 60)
        .forEach((s) => {
          if (!out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
        });
    }
  }
  return out;
}

export function mapTrack(t: AudiusTrack): Track {
  const primary = t.artists?.[0];
  const artistName = primary?.name || t.user?.name || "Unknown artist";
  const artistId = primary?.id || t.user_id || t.user?.id;
  const featured = (t.artists?.slice(1).map((a) => a.name) || []).filter(Boolean);
  const fromTitle = parseFeatured(t.title).filter(
    (n) => n.toLowerCase() !== artistName.toLowerCase() && !featured.some((f) => f.toLowerCase() === n.toLowerCase()),
  );
  return {
    id: `audius:${t.id}`,
    provider: "audius",
    providerId: t.id,
    title: t.title,
    artist: artistName,
    artistId: artistId ? `audius:${artistId}` : undefined,
    artistArtwork: pickArt(t.user?.profile_picture, "480x480"),
    featuredArtists: [...featured, ...fromTitle],
    album: t.album_backlink?.playlist_name,
    albumId: t.album_backlink?.playlist_id ? `audius:${t.album_backlink.playlist_id}` : undefined,
    duration: Number(t.duration) || 0,
    artwork: pickArt(t.artwork),
    artworkSmall: pickArt(t.artwork, "480x480"),
    genre: t.genre || undefined,
    mood: t.mood || undefined,
    playCount: typeof t.play_count === "number" ? t.play_count : undefined,
    releaseDate: t.release_date || t.created_at || undefined,
    downloadable: Boolean(t.is_downloadable) && !t.is_stream_gated,
    streamable: t.is_available !== false && t.is_streamable !== false && !t.is_stream_gated,
    permalink: t.permalink,
  };
}

function mapArtist(a: AudiusUser): ArtistSummary {
  return {
    id: `audius:${a.id}`,
    provider: "audius",
    providerId: a.id,
    name: a.name,
    artwork: pickArt(a.profile_picture, "480x480"),
    followerCount: a.follower_count,
    trackCount: a.track_count,
    verified: Boolean(a.verified || a.is_verified),
  };
}

function mapAlbum(p: AudiusPlaylist): AlbumSummary {
  return {
    id: `audius:${p.id}`,
    provider: "audius",
    providerId: p.id,
    name: p.playlist_name,
    artist: p.user?.name || "Unknown artist",
    artistId: p.user ? `audius:${p.user.id}` : undefined,
    artwork: pickArt(p.artwork),
    trackCount: p.track_count,
    releaseDate: p.release_date || p.created_at,
  };
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  return fetchJson<T>(`${BASE}${path}?${q(params)}`, { timeout: 9000 });
}

async function trending(limit = 24, genre?: string): Promise<Track[]> {
  return cached(`audius:trending:${genre ?? "all"}:${limit}`, 5 * 60_000, async () => {
    const res = await get<ListResponse<AudiusTrack>>("/tracks/trending", {
      limit,
      time: "week",
      genre,
    });
    return (res.data || []).map(mapTrack).filter((t) => t.streamable);
  });
}

const GENRES = ["Electronic", "Hip-Hop/Rap", "Lo-Fi", "House", "Ambient", "Pop", "R&B/Soul", "Rock"];

export const audiusProvider: MusicProvider = {
  id: "audius",
  label: "Audius",

  async availability(): Promise<ProviderAvailability> {
    try {
      await get<ListResponse<AudiusTrack>>("/tracks/trending", { limit: 1 });
      return { provider: "audius", available: true };
    } catch (err) {
      return {
        provider: "audius",
        available: false,
        reason: err instanceof Error ? err.message : "Audius is unreachable",
      };
    }
  },

  async home(): Promise<HomeSection[]> {
    const [global, ...genreRows] = await Promise.all([
      trending(24),
      ...GENRES.slice(0, 4).map(async (genre) => {
        const tracks = await trending(16, genre).catch(() => [] as Track[]);
        return { genre, tracks };
      }),
      // Artist row built from the trending tracks' real owners.
      Promise.resolve(null),
    ]);
    const sections: HomeSection[] = [
      {
        id: "trending",
        title: "Trending this week",
        subtitle: "What the Audius community is playing right now",
        kind: "tracks",
        items: global,
      },
    ];

    const artists = new Map<string, ArtistSummary>();
    for (const track of global) {
      if (track.artistId && !artists.has(track.artistId) && track.artist !== "Unknown artist") {
        artists.set(track.artistId, {
          id: track.artistId,
          provider: "audius",
          providerId: track.artistId.split(":")[1],
          name: track.artist,
          artwork: track.artistArtwork || track.artworkSmall,
        });
      }
    }
    if (artists.size >= 4) {
      sections.push({
        id: "artists",
        title: "Artists worth following",
        subtitle: "Independent artists behind the week's biggest tracks",
        kind: "artists",
        items: [...artists.values()].slice(0, 14),
      });
    }

    for (const row of genreRows) {
      if (row && "tracks" in row && row.tracks.length >= 4) {
        sections.push({
          id: `genre-${row.genre}`,
          title: row.genre,
          subtitle: `Popular ${row.genre.toLowerCase()} right now`,
          kind: "tracks",
          items: row.tracks,
        });
      }
    }
    return sections;
  },

  async search(query, limit = 20): Promise<SearchResults> {
    const term = query.trim();
    if (!term) return { tracks: [], artists: [], albums: [] };
    return cached(`audius:search:${term}:${limit}`, 3 * 60_000, async () => {
      const [tracksRes, usersRes, playlistsRes] = await Promise.all([
        get<ListResponse<AudiusTrack>>("/tracks/search", { query: term, limit }).catch(() => ({ data: [] })),
        get<ListResponse<AudiusUser>>("/users/search", { query: term, limit: 8 }).catch(() => ({ data: [] })),
        get<ListResponse<AudiusPlaylist>>("/playlists/search", { query: term, limit: 12 }).catch(() => ({ data: [] })),
      ]);
      return {
        tracks: (tracksRes.data || []).map(mapTrack).filter((t) => t.streamable),
        artists: (usersRes.data || []).map(mapArtist),
        albums: (playlistsRes.data || []).filter((p) => p.is_album).map(mapAlbum),
      };
    });
  },

  async track(id) {
    return cached(`audius:track:${id}`, 10 * 60_000, async () => {
      const res = await get<ListResponse<AudiusTrack> | SingleResponse<AudiusTrack>>(
        `/tracks/${encodeURIComponent(id)}`,
      );
      const track = firstOf(res);
      return track ? mapTrack(track) : null;
    });
  },

  async artist(id) {
    return cached(`audius:artist:${id}`, 5 * 60_000, async () => {
      const userRes = await get<ListResponse<AudiusUser> | SingleResponse<AudiusUser>>(
        `/users/${encodeURIComponent(id)}`,
      );
      const user = firstOf(userRes);
      if (!user) return null;
      const [tracksRes, albumsRes, playlistsRes] = await Promise.all([
        get<ListResponse<AudiusTrack>>(`/users/${id}/tracks`, { sort: "plays", limit: 50 }).catch(() => ({ data: [] })),
        get<ListResponse<AudiusPlaylist>>(`/users/${id}/albums`, { limit: 20 }).catch(() => ({ data: [] })),
        get<ListResponse<AudiusPlaylist>>(`/users/${id}/playlists`, { limit: 20 }).catch(() => ({ data: [] })),
      ]);
      const tracks = (tracksRes.data || []).map(mapTrack).filter((t) => t.streamable);
      const byPlays = [...tracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
      const byDate = [...tracks].sort(
        (a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime(),
      );
      const artist: Artist = {
        ...mapArtist(user),
        bio: user.bio?.trim() || undefined,
        coverArtwork: pickArt(user.cover_photo, "1000x1000"),
        albums: (albumsRes.data || []).map(mapAlbum),
        playlists: (playlistsRes.data || []).filter((p) => !p.is_album).map(mapAlbum),
        topTracks: byPlays.slice(0, 12),
        latestTracks: byDate.slice(0, 12),
      };
      return artist;
    });
  },

  async album(id) {
    return cached(`audius:album:${id}`, 5 * 60_000, async () => {
      const meta = await get<ListResponse<AudiusPlaylist> | SingleResponse<AudiusPlaylist>>(
        `/playlists/${encodeURIComponent(id)}`,
      );
      const playlist = firstOf(meta);
      if (!playlist) return null;
      const tracksRes = await get<ListResponse<AudiusTrack>>(`/playlists/${id}/tracks`);
      const tracks = (tracksRes.data || []).map(mapTrack);
      const album: Album = {
        ...mapAlbum(playlist),
        description: playlist.description?.trim() || undefined,
        duration: tracks.reduce((sum, t) => sum + (t.duration || 0), 0),
        tracks,
      };
      return album;
    });
  },

  /** The genre shelf: real covers, taken from each genre's current top track. */
  async genres(): Promise<GenreSummary[]> {
    return cached("audius:genres", 10 * 60_000, async () => {
      const rows = await Promise.all(
        GENRES.map(async (name) => {
          const tracks = await trending(3, name).catch(() => [] as Track[]);
          return { name, artwork: tracks[0]?.artworkSmall || tracks[0]?.artwork, trackCount: tracks.length };
        }),
      );
      return rows.filter((row) => row.artwork);
    });
  },

  async genreTracks(genre, limit = 50) {
    return trending(limit, genre);
  },

  async artistTracks(artistId, limit = 25) {
    // Accept both the unified `audius:<id>` key and the bare upstream id.
    const nativeId = artistId.includes(":") ? artistId.split(":").slice(1).join(":") : artistId;
    return cached(`audius:artist-tracks:${nativeId}:${limit}`, 5 * 60_000, async () => {
      const res = await get<ListResponse<AudiusTrack>>(`/users/${encodeURIComponent(nativeId)}/tracks`, {
        sort: "plays",
        limit,
      });
      return (res.data || []).map(mapTrack).filter((t) => t.streamable);
    });
  },

  async streamUrl(id) {
    // The API answers with a 302 to a signed, time-limited CDN URL. The proxy
    // follows that redirect itself — resolving it here would make every play
    // wait on a second connection to the audio CDN.
    return `${BASE}/tracks/${encodeURIComponent(id)}/stream?${q()}`;
  },
};

export const audiusGenres = GENRES;
