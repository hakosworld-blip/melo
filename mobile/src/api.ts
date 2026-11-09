import type { AlbumSummary, ArtistSummary, HomeSection, SearchResults, Track } from './types';

const BASE = 'https://api.audius.co/v1';
const APP = 'melo';

type AudiusArt = Record<string, string> | undefined | null;

function pickArt(art: AudiusArt, size: '150x150' | '480x480' | '1000x1000' = '1000x1000') {
  if (!art) return undefined;
  return art[size] || art['480x480'] || art['1000x1000'] || art['150x150'];
}

interface AudiusUser {
  id: string;
  name: string;
  handle: string;
  follower_count?: number;
  track_count?: number;
  verified?: boolean;
  is_verified?: boolean;
  profile_picture?: AudiusArt;
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
  is_downloadable?: boolean;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_available?: boolean;
  album_backlink?: { playlist_id?: string; playlist_name?: string } | null;
}

interface AudiusPlaylist {
  id: string;
  playlist_name: string;
  is_album?: boolean;
  track_count?: number;
  artwork?: AudiusArt;
  user?: AudiusUser;
  release_date?: string;
  created_at?: string;
}

interface ListResponse<T> {
  data: T[];
}

function q(extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams({ app_name: APP });
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  return params.toString();
}

async function getJson<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(`${BASE}${path}?${q(params)}`, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Audius request failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeatured(title: string): string[] {
  const out: string[] = [];
  const re = /(?:feat\.?|ft\.?|featuring|with)\s+([^()[\]]+?)(?:[)\]]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(title))) {
    m[1].split(/,|&|\band\b/i).map((s) => s.trim()).filter((s) => s && s.length < 60).forEach((s) => {
      if (!out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    });
  }
  return out;
}

export function mapTrack(t: AudiusTrack): Track {
  const primary = t.artists?.[0];
  const artistName = primary?.name || t.user?.name || 'Unknown artist';
  const artistId = primary?.id || t.user_id || t.user?.id;
  const featured = (t.artists?.slice(1).map((a) => a.name) || []).filter(Boolean);
  const fromTitle = parseFeatured(t.title).filter((n) => n.toLowerCase() !== artistName.toLowerCase() && !featured.some((f) => f.toLowerCase() === n.toLowerCase()));
  return {
    id: `audius:${t.id}`,
    provider: 'audius',
    providerId: t.id,
    title: t.title,
    artist: artistName,
    artistId: artistId ? `audius:${artistId}` : undefined,
    artistArtwork: pickArt(t.user?.profile_picture, '480x480'),
    featuredArtists: [...featured, ...fromTitle],
    album: t.album_backlink?.playlist_name,
    albumId: t.album_backlink?.playlist_id ? `audius:${t.album_backlink.playlist_id}` : undefined,
    duration: Number(t.duration) || 0,
    artwork: pickArt(t.artwork),
    artworkSmall: pickArt(t.artwork, '480x480'),
    genre: t.genre || undefined,
    mood: t.mood || undefined,
    playCount: typeof t.play_count === 'number' ? t.play_count : undefined,
    releaseDate: t.release_date || t.created_at || undefined,
    downloadable: Boolean(t.is_downloadable) && !t.is_stream_gated,
    streamable: t.is_available !== false && t.is_streamable !== false && !t.is_stream_gated,
    permalink: undefined,
  };
}

function mapArtist(a: AudiusUser): ArtistSummary {
  return {
    id: `audius:${a.id}`,
    provider: 'audius',
    providerId: a.id,
    name: a.name,
    artwork: pickArt(a.profile_picture, '480x480'),
    followerCount: a.follower_count,
    trackCount: a.track_count,
    verified: Boolean(a.verified || a.is_verified),
  };
}

function mapAlbum(p: AudiusPlaylist): AlbumSummary {
  return {
    id: `audius:${p.id}`,
    provider: 'audius',
    providerId: p.id,
    name: p.playlist_name,
    artist: p.user?.name || 'Unknown artist',
    artistId: p.user ? `audius:${p.user.id}` : undefined,
    artwork: pickArt(p.artwork),
    trackCount: p.track_count,
    releaseDate: p.release_date || p.created_at,
  };
}

async function trending(limit = 24, genre?: string): Promise<Track[]> {
  const res = await getJson<ListResponse<AudiusTrack>>('/tracks/trending', { limit, time: 'week', genre });
  return (res.data || []).map(mapTrack).filter((t) => t.streamable);
}

const GENRES = ['Electronic', 'Hip-Hop/Rap', 'Lo-Fi', 'House'];

export async function fetchHome(): Promise<HomeSection[]> {
  const [global, ...genreRows] = await Promise.all([
    trending(24),
    ...GENRES.map(async (genre) => ({ genre, tracks: await trending(16, genre).catch(() => [] as Track[]) })),
  ]);
  const sections: HomeSection[] = [{ id: 'trending', title: 'Trending this week', subtitle: 'What the Audius community is playing right now', kind: 'tracks', items: global }];
  const artists = new Map<string, ArtistSummary>();
  for (const track of global) {
    if (track.artistId && !artists.has(track.artistId) && track.artist !== 'Unknown artist') {
      artists.set(track.artistId, { id: track.artistId, provider: 'audius', providerId: track.artistId.split(':')[1], name: track.artist, artwork: track.artistArtwork || track.artworkSmall });
    }
  }
  if (artists.size >= 4) sections.push({ id: 'artists', title: 'Artists worth following', subtitle: 'Independent artists behind the week’s biggest tracks', kind: 'artists', items: [...artists.values()].slice(0, 14) });
  for (const row of genreRows) {
    if (row.tracks.length >= 4) sections.push({ id: `genre-${row.genre}`, title: row.genre, subtitle: `Popular ${row.genre.toLowerCase()} right now`, kind: 'tracks', items: row.tracks });
  }
  return sections;
}

export async function searchAudius(query: string, limit = 20): Promise<SearchResults> {
  const term = query.trim();
  if (!term) return { tracks: [], artists: [], albums: [] };
  const [tracksRes, usersRes, playlistsRes] = await Promise.all([
    getJson<ListResponse<AudiusTrack>>('/tracks/search', { query: term, limit }).catch(() => ({ data: [] as AudiusTrack[] })),
    getJson<ListResponse<AudiusUser>>('/users/search', { query: term, limit: 8 }).catch(() => ({ data: [] as AudiusUser[] })),
    getJson<ListResponse<AudiusPlaylist>>('/playlists/search', { query: term, limit: 12 }).catch(() => ({ data: [] as AudiusPlaylist[] })),
  ]);
  return {
    tracks: (tracksRes.data || []).map(mapTrack).filter((t) => t.streamable),
    artists: (usersRes.data || []).map(mapArtist),
    albums: (playlistsRes.data || []).filter((p) => p.is_album).map(mapAlbum),
  };
}

export function streamUrl(track: Track): string {
  return `${BASE}/tracks/${encodeURIComponent(track.providerId)}/stream?${q()}`;
}
