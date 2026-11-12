/** One source: YouTube Music, read and streamed through a melo server. */
export type ProviderId = 'youtube';

export interface Track {
  id: string;
  provider: ProviderId;
  providerId: string;
  title: string;
  artist: string;
  artistId?: string;
  artistArtwork?: string;
  featuredArtists: string[];
  album?: string;
  albumId?: string;
  duration: number;
  artwork?: string;
  artworkSmall?: string;
  genre?: string;
  mood?: string;
  playCount?: number;
  releaseDate?: string;
  downloadable: boolean;
  streamable: boolean;
  permalink?: string;
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

export interface SearchResults {
  tracks: Track[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
}

export interface HomeSection {
  id: string;
  title: string;
  subtitle?: string;
  kind: 'tracks' | 'artists' | 'albums';
  items: Track[] | ArtistSummary[] | AlbumSummary[];
}
