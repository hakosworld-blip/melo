/**
 * Reading a public YouTube Music playlist.
 *
 * Unlike the Spotify importer there is no matching step here: a YouTube
 * playlist already names the exact videos, so every song is imported as the
 * track that was in the playlist. Resolution happens at play time through
 * yt-dlp, the same path the YouTube Music provider already uses, which means
 * these songs stream and cannot be downloaded.
 */

import { UpstreamError } from "./http";
import { mapEntry, splitTitle, ytdlp } from "./provider/youtube";
import type { Track } from "./types";

export interface YoutubePlaylistRef {
  id: string;
  name: string;
  owner?: string;
  tracks: Track[];
  /** True when the playlist is longer than melo reads in one go. */
  capped: boolean;
}

/** Playlists are read up to this many songs; longer ones are truncated openly. */
const LIMIT = 200;

/** Accepts music.youtube.com / youtube.com playlist links, watch links with a
 * list parameter, and bare playlist ids. */
export function parseYoutubePlaylistId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/youtu\.?be|youtube\.com/i.test(value)) {
    const list = value.match(/[?&]list=([A-Za-z0-9_-]{10,})/);
    if (list) return list[1];
    return null;
  }
  if (/^(?:PL|UU|OLAK5uy_|RD|LL|VL)[A-Za-z0-9_-]{8,}$/.test(value)) return value;
  return null;
}

interface PlaylistInfo {
  title?: string;
  playlist_title?: string;
  uploader?: string;
  channel?: string;
  entries?: Parameters<typeof mapEntry>[0][];
}

export async function readYoutubePlaylist(id: string): Promise<YoutubePlaylistRef> {
  const url = `https://music.youtube.com/playlist?list=${encodeURIComponent(id)}`;
  let info: PlaylistInfo;
  try {
    const json = await ytdlp(["--flat-playlist", "-J", "--playlist-end", String(LIMIT), url], 120_000);
    info = JSON.parse(json) as PlaylistInfo;
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError("Could not read that YouTube playlist.", 502);
  }

  const entries = info.entries ?? [];
  const tracks: Track[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const track = mapEntry(entry);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    // Playlist titles are often "Song - Artist"; the channel tells us which way round.
    const channel = entry.channel || entry.uploader;
    if (channel && entry.title) {
      const shown = splitTitle(entry.title, channel);
      if (shown.title) track.title = shown.title;
    }
    tracks.push(track);
  }

  if (!tracks.length) {
    throw new UpstreamError(
      "This playlist is empty, private, or has no playable videos. Make sure the link is public.",
      422,
    );
  }

  const name = (info.title || info.playlist_title || "").trim() || "YouTube playlist";
  const owner = (info.uploader || info.channel || "").trim() || undefined;

  return { id, name, owner, tracks, capped: entries.length >= LIMIT };
}
