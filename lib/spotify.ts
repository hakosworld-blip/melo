/**
 * Reading a public Spotify playlist without an account or a developer key.
 *
 * Spotify's public embed page ships the playlist name and its first tracks as
 * JSON, so melo can resolve a pasted link server-side. The embed is capped at
 * 100 tracks, which is reported to the caller rather than hidden.
 */

import { UpstreamError } from "./http";

export interface SpotifyTrackRef {
  title: string;
  /** Split artist names, when the playlist separates them. */
  artists: string[];
  /** Artist line exactly as Spotify shows it. */
  artistLine: string;
  /** Seconds. 0 when Spotify does not report one. */
  duration: number;
  album?: string;
}

export interface SpotifyPlaylistRef {
  id: string;
  name: string;
  owner?: string;
  tracks: SpotifyTrackRef[];
  /** Spotify only exposes the first 100 tracks of a public playlist. */
  capped: boolean;
}

const EMBED_CAP = 100;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Accepts open.spotify.com links, embed links, spotify: URIs and bare ids. */
export function parsePlaylistId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const uri = value.match(/^spotify:playlist:([A-Za-z0-9]{10,})$/);
  if (uri) return uri[1];
  const url = value.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/([A-Za-z0-9]{10,})/i);
  if (url) return url[1];
  if (/^[A-Za-z0-9]{22}$/.test(value)) return value;
  return null;
}

interface EmbedTrack {
  uri?: string;
  title?: string;
  subtitle?: string;
  duration?: number;
  entityType?: string;
  isPlayable?: boolean;
}

interface EmbedEntity {
  type?: string;
  title?: string;
  name?: string;
  subtitle?: string;
  trackList?: EmbedTrack[];
}

function cleanArtistLine(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function toTrackRef(track: EmbedTrack): SpotifyTrackRef | null {
  const title = track.title?.trim();
  const artistLine = cleanArtistLine(track.subtitle ?? "");
  if (!title) return null;
  if (track.entityType && track.entityType !== "track") return null;
  const artists = artistLine
    .split(/,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
  return {
    title,
    artists: artists.length ? artists : ["Unknown artist"],
    artistLine,
    duration: track.duration && track.duration > 0 ? Math.round(track.duration / 1000) : 0,
  };
}

export async function fetchSpotifyPlaylist(id: string): Promise<SpotifyPlaylistRef> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let html: string;
  try {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "text/html", "accept-language": "en", "user-agent": UA },
    });
    if (res.status === 404) throw new UpstreamError("That Spotify playlist does not exist or is not public.", 404);
    if (!res.ok) throw new UpstreamError(`Spotify responded ${res.status}.`, 502);
    html = await res.text();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new UpstreamError(aborted ? "Spotify took too long to answer." : "Could not reach Spotify.", 502);
  } finally {
    clearTimeout(timer);
  }

  const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!json) {
    throw new UpstreamError("Spotify did not return a readable playlist. Check the link is public.", 502);
  }

  let entity: EmbedEntity | undefined;
  try {
    const data = JSON.parse(json) as {
      props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
    };
    entity = data.props?.pageProps?.state?.data?.entity;
  } catch {
    throw new UpstreamError("Spotify returned data melo could not read.", 502);
  }

  if (!entity || (entity.type && entity.type !== "playlist")) {
    throw new UpstreamError("That link is not a playlist.", 400);
  }

  const name = (entity.title || entity.name || "").trim();
  if (!name) throw new UpstreamError("Spotify did not include the playlist name.", 502);

  const tracks = (entity.trackList ?? []).map(toTrackRef).filter((track): track is SpotifyTrackRef => Boolean(track));
  if (!tracks.length) {
    throw new UpstreamError("This playlist has no tracks melo can read. It may be empty or region-restricted.", 422);
  }

  const owner = entity.subtitle && entity.subtitle !== name ? cleanArtistLine(entity.subtitle) : undefined;

  return { id, name, owner, tracks, capped: tracks.length >= EMBED_CAP };
}
