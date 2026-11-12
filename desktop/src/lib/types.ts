/**
 * melo — shared domain types.
 *
 * Every music source is normalised into these shapes so the UI, player, queue,
 * downloads and offline library never need to know where a track came from.
 */

export type ProviderId = "youtube";

export interface TrackArtist {
  id: string;
  provider: ProviderId;
  name: string;
  artwork?: string;
}

export interface Track {
  /** Stable cross-provider key: `${provider}:${providerId}` */
  id: string;
  provider: ProviderId;
  providerId: string;
  title: string;
  artist: string;
  artistId?: string;
  artistArtwork?: string;
  /** Collaborators / featured artists, only when the source reports them. */
  featuredArtists: string[];
  album?: string;
  albumId?: string;
  /** Seconds. 0 when the source does not report a duration. */
  duration: number;
  artwork?: string;
  artworkSmall?: string;
  genre?: string;
  mood?: string;
  /** Real play count from the source, when reported. */
  playCount?: number;
  releaseDate?: string;
  /** true only when the source explicitly authorises downloading the file. */
  downloadable: boolean;
  /** false when the source says the track cannot be streamed (removed, gated). */
  streamable: boolean;
  permalink?: string;
}

export interface AlbumSummary {
  id: string;
  provider: ProviderId;
  providerId: string;
  name: string;
  artist: string;
  artistId?: string;
  artwork?: string;
  trackCount?: number;
  releaseDate?: string;
}

export interface Album extends AlbumSummary {
  description?: string;
  duration: number;
  tracks: Track[];
}

export interface ArtistSummary {
  id: string;
  provider: ProviderId;
  providerId: string;
  name: string;
  artwork?: string;
  followerCount?: number;
  trackCount?: number;
  verified?: boolean;
}

export interface Artist extends ArtistSummary {
  bio?: string;
  coverArtwork?: string;
  albums: AlbumSummary[];
  playlists: AlbumSummary[];
  /** Most-played songs, sorted by the source's real play counts. */
  topTracks: Track[];
  latestTracks: Track[];
}

export interface SearchResults {
  tracks: Track[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
}

export interface HomeSection {
  id: string;
  title: string;
  subtitle?: string;
  kind: "tracks" | "artists" | "albums";
  items: Track[] | ArtistSummary[] | AlbumSummary[];
}

/** A browsable genre with a real cover taken from its own top track. */
export interface GenreSummary {
  name: string;
  artwork?: string;
  trackCount?: number;
}

export interface ProviderAvailability {
  provider: ProviderId;
  available: boolean;
  reason?: string;
}

export interface LyricsLine {
  time: number;
  text: string;
  /** Enhanced LRC word timings, when the source provides them. */
  words?: { t: number; w: string }[];
}

export interface Lyrics {
  synced: boolean;
  lines: LyricsLine[];
  plain?: string;
  instrumental?: boolean;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  lrclibId: number;
}

export interface MusicProvider {
  id: ProviderId;
  label: string;
  home(): Promise<HomeSection[]>;
  search(query: string, limit?: number): Promise<SearchResults>;
  track(id: string): Promise<Track | null>;
  artist(id: string): Promise<Artist | null>;
  album(id: string): Promise<Album | null>;
  /** Resolves a direct upstream audio URL for proxying. */
  streamUrl(id: string): Promise<string>;
  availability(): Promise<ProviderAvailability>;
  /** Optional catalogue browsing, used by Home's genre row and daily mix. */
  genres?(): Promise<GenreSummary[]>;
  genreTracks?(genre: string, limit?: number): Promise<Track[]>;
  artistTracks?(artistId: string, limit?: number): Promise<Track[]>;
}

/** A locally stored (downloaded) track. */
export interface DownloadRecord {
  track: Track;
  status: "queued" | "downloading" | "complete" | "failed" | "paused";
  progress: number;
  /** true = artist-authorised download, false = private offline stream copy. */
  authorised: boolean;
  bytes: {
    audio: number;
    artwork: number;
    lyrics: number;
    metadata: number;
  };
  createdAt: number;
  error?: string;
  hasSyncedLyrics: boolean;
  hasArtwork: boolean;
}

export interface LocalPlaylist {
  id: string;
  name: string;
  description?: string;
  /** Custom artwork stored in IndexedDB, referenced by key. */
  artworkKey?: string;
  /** Fallback artwork derived from the first track, when available. */
  artworkUrl?: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}
