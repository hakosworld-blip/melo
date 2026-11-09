import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { cached } from "@/lib/cache";
import { normalise, UpstreamError } from "@/lib/http";
import type {
  Album,
  Artist,
  ArtistSummary,
  HomeSection,
  MusicProvider,
  ProviderAvailability,
  SearchResults,
  Track,
} from "@/lib/types";

/**
 * YouTube Music provider — built on yt-dlp.
 *
 * Used for discovery and metadata; audio is resolved on demand and proxied
 * through melo so the browser never sees a YouTube URL. YouTube does not
 * authorise downloading, so tracks from this provider are stream-only and the
 * UI says so. If YouTube blocks the host IP ("confirm you're not a bot"), we
 * surface a clear, actionable error instead of silently falling back.
 */

const exec = promisify(execFile);

function resolveBinary(): string {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const local = path.join(process.cwd(), "bin", "yt-dlp");
  if (existsSync(local)) return local;
  return "yt-dlp";
}

/** yt-dlp needs a JS runtime for YouTube's player JS since 2025. */
function runtimeArgs(): string[] {
  if (process.env.YTDLP_JS_RUNTIME) return ["--js-runtimes", process.env.YTDLP_JS_RUNTIME];
  return ["--js-runtimes", "node"];
}

function cookieArgs(): string[] {
  if (process.env.YTDLP_COOKIES) return ["--cookies", process.env.YTDLP_COOKIES];
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) return ["--cookies-from-browser", process.env.YTDLP_COOKIES_FROM_BROWSER];
  return [];
}

export async function ytdlp(args: string[], timeout = 45_000): Promise<string> {
  try {
    const { stdout } = await exec(resolveBinary(), [...runtimeArgs(), ...cookieArgs(), "--no-warnings", ...args], {
      timeout,
      maxBuffer: 48 * 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message?: string; code?: string };
    const raw = `${e.stderr || ""} ${e.message || ""}`;
    throw new UpstreamError(describeError(raw), 502);
  }
}

function describeError(raw: string): string {
  if (/confirm you.{0,3}re not a bot|Sign in to confirm/i.test(raw)) {
    return "YouTube is asking this server to verify it isn't a bot. melo's yt-dlp provider needs cookies on this host (YTDLP_COOKIES), or run melo from a residential connection. Audius works here — switch the music source in Settings.";
  }
  if (/Video unavailable|This video is not available|removed/i.test(raw)) return "This track is no longer available at the source.";
  if (/not installed|ENOENT/i.test(raw)) return "yt-dlp was not found. Install it, or set YTDLP_PATH.";
  if (/timed out|ETIMEDOUT/i.test(raw)) return "yt-dlp timed out while talking to YouTube.";
  return "The YouTube Music source could not complete this request.";
}

type FlatEntry = {
  id?: string;
  title?: string;
  duration?: number;
  channel?: string;
  channel_id?: string;
  uploader?: string;
  uploader_id?: string;
  view_count?: number;
  thumbnails?: { url: string; width?: number; height?: number }[];
  channel_is_verified?: boolean;
  ie_key?: string;
  _type?: string;
  description?: string;
};

type FullInfo = FlatEntry & {
  track?: string;
  artist?: string;
  album?: string;
  release_year?: number;
  upload_date?: string;
  artists?: { name?: string }[];
  album_artist?: string;
  channel_follower_count?: number;
  description?: string;
  formats?: unknown[];
};

function bestThumb(entry: FlatEntry): string | undefined {
  const thumbs = entry.thumbnails;
  if (!thumbs?.length) return undefined;
  const sorted = [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url;
}

/**
 * "Artist - Song (Official Video)" -> { artist, title }
 *
 * Most uploads put the artist first, but some put the song first. When the
 * channel is known (playlist and search entries carry one) that decides which
 * half is which, instead of showing "Song - Artist" titles mirrored.
 */
export function splitTitle(raw: string, channel?: string): { title: string; artist?: string } {
  const cleaned = raw
    .replace(/\(\s*(?:official|lyrics?|audio|video|visualizer|hd|hq|explicit|music video|performance video)[^)]*\)/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const m = cleaned.match(/^(.{1,60}?)\s+[-–—]\s+(.+)$/);
  if (m) {
    const left = m[1].trim();
    const right = m[2].trim();
    const name = channel ? normalise(channel) : "";
    if (name) {
      const leftIsName = normalise(left).startsWith(name) || name.startsWith(normalise(left));
      if (!leftIsName && normalise(right).includes(name)) return { title: left, artist: channel };
    }
    return { artist: left, title: right };
  }
  return { title: cleaned || raw };
}

export function mapEntry(entry: FlatEntry): Track | null {
  if (!entry.id || entry.ie_key === "YoutubeTab") return null;
  const parsed = splitTitle(entry.title || "");
  const artist = entry.channel || entry.uploader || parsed.artist || "Unknown artist";
  return {
    id: `youtube:${entry.id}`,
    provider: "youtube",
    providerId: entry.id,
    title: parsed.title,
    artist,
    artistId: entry.channel_id ? `youtube:${entry.channel_id}` : undefined,
    featuredArtists: [],
    duration: Number(entry.duration) || 0,
    artwork: bestThumb(entry),
    artworkSmall: bestThumb(entry),
    playCount: entry.view_count,
    downloadable: false, // YouTube does not authorise downloads.
    streamable: true,
  };
}

async function searchTracks(query: string, limit: number): Promise<FlatEntry[]> {
  const json = await ytdlp(["--flat-playlist", "-J", `ytsearch${limit}:${query}`]);
  const parsed = JSON.parse(json) as { entries?: FlatEntry[] };
  return parsed.entries || [];
}

/**
 * Flat YouTube search with real channel names and durations. Used where the
 * metadata has to be trusted more than the merged provider search (playlist
 * imports), where a missing duration or artist would defeat matching.
 */
export async function youtubeSearchTracks(query: string, limit: number): Promise<Track[]> {
  const entries = await searchTracks(query, Math.min(Math.max(limit, 1), 10));
  return entries.map(mapEntry).filter((track): track is Track => Boolean(track));
}

async function musicSearch(query: string, limit: number): Promise<{ songs: FlatEntry[]; channels: FlatEntry[] }> {
  try {
    const json = await ytdlp([
      "--flat-playlist",
      "-J",
      `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
    ]);
    const parsed = JSON.parse(json) as { entries?: FlatEntry[] };
    const entries = parsed.entries || [];
    return {
      songs: entries.filter((e) => e.ie_key !== "YoutubeTab" && e.id).slice(0, limit),
      channels: entries.filter((e) => e.ie_key === "YoutubeTab" && e.id).slice(0, 6),
    };
  } catch {
    return { songs: [], channels: [] };
  }
}

export const youtubeProvider: MusicProvider = {
  id: "youtube",
  label: "YouTube Music",

  async availability(): Promise<ProviderAvailability> {
    return cached("yt:availability", 2 * 60_000, async () => {
      try {
        const entries = await searchTracks("music", 1);
        if (!entries.length) throw new UpstreamError("YouTube returned no results");
        const first = entries[0];
        if (!first.id) throw new UpstreamError("YouTube returned no results");
        // Resolution is what actually matters for playback.
        await ytdlp(["-f", "bestaudio/best", "-g", `https://music.youtube.com/watch?v=${first.id}`], 30_000);
        return { provider: "youtube" as const, available: true };
      } catch (err) {
        return {
          provider: "youtube" as const,
          available: false,
          reason: err instanceof Error ? err.message : "YouTube Music is unreachable",
        };
      }
    });
  },

  async home(): Promise<HomeSection[]> {
    // Honest labels: these are real YouTube Music searches, not invented charts.
    const rows: { id: string; title: string; subtitle: string; query: string }[] = [
      { id: "hits", title: "Popular on YouTube Music", subtitle: "Top results for this week's hits", query: "top hits" },
      { id: "chill", title: "Chill", subtitle: "Laid-back songs for a slower pace", query: "chill songs" },
      { id: "focus", title: "Focus", subtitle: "Instrumental and lo-fi", query: "lofi instrumental" },
      { id: "throwback", title: "Throwbacks", subtitle: "Songs you grew up with", query: "throwback hits" },
    ];
    const sections: HomeSection[] = [];
    await Promise.all(
      rows.map(async (row) => {
        try {
          const entries = await searchTracks(row.query, 16);
          const items = entries.map(mapEntry).filter((t): t is Track => Boolean(t));
          if (items.length >= 4) {
            sections.push({ id: row.id, title: row.title, subtitle: row.subtitle, kind: "tracks", items });
          }
        } catch {
          // A blocked/unavailable YouTube host simply yields no rows.
        }
      }),
    );
    const order = ["hits", "chill", "focus", "throwback"];
    return sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  },

  async search(query, limit = 20): Promise<SearchResults> {
    const term = query.trim();
    if (!term) return { tracks: [], artists: [], albums: [] };
    return cached(`yt:search:${term}:${limit}`, 3 * 60_000, async () => {
      const [music, flat] = await Promise.all([
        musicSearch(term, limit),
        searchTracks(term, limit).catch(() => [] as FlatEntry[]),
      ]);
      const seen = new Set<string>();
      const tracks: Track[] = [];
      for (const entry of [...music.songs, ...flat]) {
        const track = mapEntry(entry);
        if (track && !seen.has(track.id)) {
          seen.add(track.id);
          tracks.push(track);
        }
      }
      const artists: ArtistSummary[] = music.channels.map((c) => ({
        id: `youtube:${c.id}`,
        provider: "youtube",
        providerId: c.id!,
        name: (c.title || "Unknown artist").replace(/\s*-\s*Topic$/, ""),
        artwork: bestThumb(c),
        verified: c.channel_is_verified,
      }));
      return { tracks: tracks.slice(0, limit), artists, albums: [] };
    });
  },

  async track(id) {
    return cached(`yt:track:${id}`, 10 * 60_000, async () => {
      const json = await ytdlp(["-J", `https://music.youtube.com/watch?v=${id}`]);
      const info = JSON.parse(json) as FullInfo;
      const parsed = splitTitle(info.track || info.title || "");
      const artist = info.artist || info.album_artist || info.channel || info.uploader || parsed.artist || "Unknown artist";
      const year = info.release_year || (info.upload_date ? Number(info.upload_date.slice(0, 4)) : undefined);
      const track: Track = {
        id: `youtube:${id}`,
        provider: "youtube",
        providerId: id,
        title: info.track || parsed.title,
        artist,
        artistId: info.channel_id ? `youtube:${info.channel_id}` : undefined,
        artistArtwork: undefined,
        featuredArtists: (info.artists || []).map((a) => a.name || "").filter((n) => n && n !== artist),
        album: info.album || undefined,
        duration: Number(info.duration) || 0,
        artwork: bestThumb(info),
        artworkSmall: bestThumb(info),
        playCount: info.view_count,
        releaseDate: year ? `${year}-01-01` : undefined,
        downloadable: false,
        streamable: true,
        permalink: `https://music.youtube.com/watch?v=${id}`,
      };
      return track;
    });
  },

  async artist(id) {
    return cached(`yt:artist:${id}`, 5 * 60_000, async () => {
      const json = await ytdlp(["--flat-playlist", "-J", "--playlist-end", "60", `https://www.youtube.com/channel/${id}/videos`]);
      const info = JSON.parse(json) as FlatEntry & { channel?: string; title?: string; description?: string; entries?: FlatEntry[] };
      const entries = info.entries || [];
      const tracks = entries
        .map((e) => mapEntry({ ...e, channel: e.channel || info.channel || info.title }))
        .filter((t): t is Track => Boolean(t));
      if (!tracks.length) return null;
      const byViews = [...tracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
      const artist: Artist = {
        id: `youtube:${id}`,
        provider: "youtube",
        providerId: id,
        name: (info.title || info.channel || "Unknown artist").replace(/\s*-\s*Topic$/, ""),
        artwork: bestThumb(info),
        bio: info.description?.trim() || undefined,
        albums: [],
        playlists: [],
        topTracks: byViews.slice(0, 12),
        latestTracks: tracks.slice(0, 12),
      };
      return artist;
    });
  },

  async album(_id): Promise<Album | null> {
    // YouTube Music album pages are playlist ids; yt-dlp can resolve them, but
    // album search isn't part of the flat search API, so albums are surfaced
    // through track metadata only. See README → provider limitations.
    return null;
  },

  async streamUrl(id) {
    return cached(`yt:stream:${id}`, 15 * 60_000, async () => {
      const url = (
        await ytdlp(["-f", "bestaudio/best", "-g", `https://music.youtube.com/watch?v=${id}`], 40_000)
      )
        .trim()
        .split("\n")[0];
      if (!url?.startsWith("http")) throw new UpstreamError("YouTube did not return a playable stream");
      return url;
    });
  },
};
