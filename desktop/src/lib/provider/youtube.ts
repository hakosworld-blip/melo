import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { cached, cacheDelete } from "@/lib/cache";
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

/**
 * yt-dlp's default player clients mint googlevideo URLs that Google answers
 * with 403 from many hosts, which surfaced as "couldn't be played". The
 * android and tv_simply clients hand out URLs that actually stream; override
 * with YTDLP_PLAYER_CLIENT if a host needs its own list.
 */
function clientArgs(): string[] {
  const client = process.env.YTDLP_PLAYER_CLIENT || "android,tv_simply";
  return ["--extractor-args", `youtube:player_client=${client}`];
}

function cookieArgs(): string[] {
  if (process.env.YTDLP_COOKIES) return ["--cookies", process.env.YTDLP_COOKIES];
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) return ["--cookies-from-browser", process.env.YTDLP_COOKIES_FROM_BROWSER];
  return [];
}

export async function ytdlp(args: string[], timeout = 45_000): Promise<string> {
  try {
    const { stdout } = await exec(
      resolveBinary(),
      [...runtimeArgs(), ...cookieArgs(), ...clientArgs(), "--no-warnings", ...args],
      {
      timeout,
        maxBuffer: 48 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      },
    );
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; message?: string; code?: string };
    const raw = `${e.stderr || ""} ${e.message || ""}`;
    throw new UpstreamError(describeError(raw), 502);
  }
}

function describeError(raw: string): string {
  if (/confirm you.{0,3}re not a bot|Sign in to confirm/i.test(raw)) {
    return "YouTube is asking this server to verify it isn't a bot. melo needs cookies on this host (YTDLP_COOKIES), or a residential connection.";
  }
  if (/Video unavailable|This video is not available|removed/i.test(raw)) return "This track is no longer available at the source.";
  if (/not installed|ENOENT/i.test(raw)) return "yt-dlp was not found. Install it, or set YTDLP_PATH.";
  if (/timed out|ETIMEDOUT/i.test(raw)) return "yt-dlp timed out while talking to YouTube.";
  return "The YouTube Music source could not complete this request.";
}

type FlatEntry = {
  id?: string;
  title?: string;
  track?: string;
  artist?: string;
  album_artist?: string;
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
  artists?: { name?: string }[];
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
 * Artwork for a video id, independent of what the extractor reported.
 *
 * Flat search/playlist entries often arrive without a `thumbnails` array, and
 * YouTube serves these sizes for every public video; without the fallback a
 * whole shelf renders as grey placeholders even though the video is fine.
 */
function thumbForId(id: string | undefined, size: "big" | "small"): string | undefined {
  if (!id) return undefined;
  return `https://i.ytimg.com/vi/${id}/${size === "big" ? "hqdefault" : "mqdefault"}.jpg`;
}

function artworkFor(entry: FlatEntry): { artwork?: string; artworkSmall?: string } {
  const reported = bestThumb(entry);
  return {
    artwork: reported || thumbForId(entry.id, "big"),
    artworkSmall: thumbForId(entry.id, "small") || reported,
  };
}

/** "Artist - Topic" and "ArtistVEVO" are uploads, not artist names. */
function cleanArtistName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const name = raw.replace(/\s*-\s*Topic$/i, "").replace(/\s*VEVO$/i, "").trim();
  return name || undefined;
}

function artistFor(entry: FlatEntry, parsedArtist?: string): string {
  return (
    cleanArtistName(entry.artists?.find((artist) => artist?.name)?.name) ??
    cleanArtistName(entry.artist) ??
    cleanArtistName(entry.album_artist) ??
    cleanArtistName(entry.channel) ??
    cleanArtistName(entry.uploader) ??
    parsedArtist ??
    "Unknown artist"
  );
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
  const parsed = entry.track ? { title: entry.track } : splitTitle(entry.title || "", entry.channel);
  const artist = artistFor(entry, parsed.artist);
  return {
    id: `youtube:${entry.id}`,
    provider: "youtube",
    providerId: entry.id,
    title: parsed.title,
    artist,
    artistId: entry.channel_id ? `youtube:${entry.channel_id}` : undefined,
    featuredArtists: [],
    duration: Number(entry.duration) || 0,
    ...artworkFor(entry),
    playCount: entry.view_count,
    downloadable: false, // YouTube does not authorise downloads.
    streamable: true,
  };
}

/* ------------------------------------------------------- metadata rescue */

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string };

const oembedCache = new Map<string, OEmbed | null>();

/**
 * YouTube's public oEmbed endpoint answers with the channel name and artwork
 * for any public video: no API key, and none of the bot checking that blocks
 * yt-dlp on datacenter IPs. It is one small JSON document, so it is only used
 * for rows whose extractor entry arrived incomplete, and cached in memory.
 */
async function oembed(id: string): Promise<OEmbed | null> {
  if (oembedCache.has(id)) return oembedCache.get(id) ?? null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) throw new Error(`oembed ${res.status}`);
    const data = (await res.json()) as OEmbed;
    if (oembedCache.size > 800) oembedCache.clear();
    oembedCache.set(id, data);
    return data;
  } catch {
    oembedCache.set(id, null);
    return null;
  }
}

function needsArtist(track: Track) {
  return !track.artist || track.artist === "Unknown artist";
}

/**
 * Fills in the artist and artwork for rows that arrived without them, up to
 * `cap` lookups per call. Exported so the rescue can be checked on its own.
 */
export async function enrichMissing(tracks: Track[], cap = 8): Promise<Track[]> {
  const needy = tracks.filter((track) => needsArtist(track) || !track.artwork).slice(0, cap);
  if (!needy.length) return tracks;
  await Promise.all(
    needy.map(async (track) => {
      const meta = await oembed(track.providerId);
      if (!meta) return;
      if (needsArtist(track)) {
        const name = cleanArtistName(meta.author_name);
        if (name) track.artist = name;
      }
      if (!track.artwork && meta.thumbnail_url) {
        track.artwork = meta.thumbnail_url;
        track.artworkSmall = meta.thumbnail_url;
      }
    }),
  );
  return tracks;
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
  const capped = Math.min(Math.max(limit, 1), 10);
  const music = await musicSearch(query, capped).catch(() => ({ songs: [] as FlatEntry[], channels: [] as FlatEntry[] }));
  const entries = music.songs.length ? music.songs : await searchTracks(query, capped);
  return entries.map(mapEntry).filter((track): track is Track => Boolean(track));
}

/**
 * Search on music.youtube.com itself. Throws when the surface is unreachable
 * so callers can report the real reason instead of pretending the catalogue is
 * empty; callers that can live with no results catch it locally.
 */
async function musicSearch(query: string, limit: number): Promise<{ songs: FlatEntry[]; channels: FlatEntry[] }> {
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
}

/* ------------------------------------------------ YouTube Music web search */

/**
 * YouTube Music has no key-free public API, but its own web client answers
 * "songs only" searches with exactly what a music app needs: title, artist,
 * album, duration and artwork. This is the source discovery uses, so melo asks
 * music.youtube.com — never youtube.com search — and no yt-dlp round trip is
 * needed to fill Home or Search.
 */
const YTM_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
/** Encoded WEB_REMIX search filter for "Songs". */
const YTM_SONGS_PARAMS = "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

type YtmRun = { text?: string; navigationEndpoint?: { browseEndpoint?: { browseId?: string } } };

type YtmSong = {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  duration: number;
  artwork?: string;
};

let ytmClient: { key: string; version: string; at: number } | null = null;

async function ytmClientInfo(): Promise<{ key: string; version: string }> {
  if (ytmClient && Date.now() - ytmClient.at < 6 * 60 * 60_000) return ytmClient;
  const res = await fetch("https://music.youtube.com/", {
    headers: { "user-agent": YTM_UA, "accept-language": "en-US,en" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new UpstreamError(`YouTube Music answered ${res.status}`);
  const html = await res.text();
  const key = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const version = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
  if (!key || !version) throw new UpstreamError("YouTube Music did not expose its web client");
  ytmClient = { key, version, at: Date.now() };
  return ytmClient;
}

function clockSeconds(raw: string): number {
  const parts = raw.split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Pulls the song rows out of a WEB_REMIX search response. */
function readYtmSongs(payload: unknown): YtmSong[] {
  const songs: YtmSong[] = [];
  const seen = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Loose;
    const renderer = record.musicResponsiveListItemRenderer as Loose | undefined;
    if (renderer) {
      const columns = (renderer.flexColumns ?? []) as Loose[];
      const runs = (index: number): YtmRun[] =>
        (columns[index]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []) as YtmRun[];
      const title = runs(0).map((run) => run.text ?? "").join("");
      const meta = runs(1);
      const id = renderer.playlistItemData?.videoId as string | undefined;
      if (title && id && !seen.has(id)) {
        seen.add(id);
        const clock = meta.map((run) => run.text ?? "").find((text) => /^\d{1,2}(:\d{2})+$/.test(text));
        const thumbs = (renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? []) as Loose[];
        songs.push({
          id,
          title,
          artist: cleanArtistName(meta[0]?.text),
          artistId: meta[0]?.navigationEndpoint?.browseEndpoint?.browseId,
          album: meta[2]?.text,
          duration: clock ? clockSeconds(clock) : 0,
          artwork: (thumbs.at(-1)?.url as string | undefined) || undefined,
        });
      }
    }
    for (const value of Object.values(record)) visit(value);
  };
  visit(payload);
  return songs;
}

async function ytmSearchSongs(query: string, limit: number): Promise<YtmSong[]> {
  return cached(`ytm:songs:${query}:${limit}`, 5 * 60_000, async () => {
    const client = await ytmClientInfo();
    const res = await fetch(
      `https://music.youtube.com/youtubei/v1/search?prettyPrint=false&key=${client.key}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": YTM_UA,
          "accept-language": "en-US,en",
          origin: "https://music.youtube.com",
        },
        body: JSON.stringify({
          context: { client: { clientName: "WEB_REMIX", clientVersion: client.version, hl: "en", gl: "US" } },
          query,
          params: YTM_SONGS_PARAMS,
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) throw new UpstreamError(`YouTube Music answered ${res.status}`);
    // "Songs" still includes hour-long compilations uploaded as songs; a shelf
    // of those is not a shelf of songs, so anything past 15 minutes is dropped.
    const songs = readYtmSongs(await res.json()).filter(
      (song) => song.duration === 0 || (song.duration >= 30 && song.duration <= 900),
    );
    if (!songs.length) throw new UpstreamError("YouTube Music answered, but returned no songs for this host.");
    return songs.slice(0, limit);
  });
}

function trackFromYtm(song: YtmSong): Track {
  return {
    id: `youtube:${song.id}`,
    provider: "youtube",
    providerId: song.id,
    title: song.title,
    artist: song.artist ?? "Unknown artist",
    artistId: song.artistId ? `youtube:${song.artistId}` : undefined,
    featuredArtists: [],
    album: song.album,
    duration: song.duration,
    artwork: song.artwork,
    artworkSmall: thumbForId(song.id, "small") || song.artwork,
    downloadable: false,
    streamable: true,
  };
}

export const youtubeProvider: MusicProvider = {
  id: "youtube",
  label: "YouTube Music",

  async availability(): Promise<ProviderAvailability> {
    return cached("yt:availability", 2 * 60_000, async () => {
      try {
        // Probe the same surface discovery uses: YouTube Music, not youtube.com.
        const songs = await ytmSearchSongs("top hits", 5);
        const first = songs[0];
        if (!first?.id) throw new UpstreamError("YouTube Music returned no results");
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
    // Discovery runs on music.youtube.com only. Plain youtube.com search used to
    // back these shelves, and on hosts where YouTube Music still answers it
    // came back empty — the app then claimed the source had no songs at all.
    const rows: { id: string; title: string; subtitle: string; query: string }[] = [
      { id: "hits", title: "Popular on YouTube Music", subtitle: "Top results for this week's hits", query: "top hits" },
      { id: "chill", title: "Chill", subtitle: "Laid-back songs for a slower pace", query: "chill songs" },
      { id: "focus", title: "Focus", subtitle: "Instrumental and lo-fi", query: "lofi songs" },
      { id: "throwback", title: "Throwbacks", subtitle: "Songs you grew up with", query: "throwback hits" },
    ];
    const sections: HomeSection[] = [];
    let failure: unknown = null;
    await Promise.all(
      rows.map(async (row) => {
        try {
          // Songs come from YouTube Music's own search; yt-dlp's flat search is
          // the fallback for hosts where the web client refuses to answer.
          let items: Track[] = [];
          try {
            items = (await ytmSearchSongs(row.query, 18)).map(trackFromYtm);
          } catch {
            const { songs } = await musicSearch(row.query, 18);
            items = songs.map(mapEntry).filter((t): t is Track => Boolean(t));
          }
          items = await enrichMissing(items, 10);
          if (items.length) {
            sections.push({ id: row.id, title: row.title, subtitle: row.subtitle, kind: "tracks", items });
          } else if (!failure) {
            failure = new UpstreamError("YouTube Music answered, but returned no songs for this host.");
          }
        } catch (err) {
          if (!failure) failure = err;
        }
      }),
    );
    const order = ["hits", "chill", "focus", "throwback"];
    sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    // Nothing to show and a real reason why: surface it instead of no shelves.
    if (!sections.length && failure) throw failure;
    return sections;
  },

  async search(query, limit = 20): Promise<SearchResults> {
    const term = query.trim();
    if (!term) return { tracks: [], artists: [], albums: [] };
    return cached(`yt:search:${term}:${limit}`, 3 * 60_000, async () => {
      // YouTube Music's own song search first: real songs, real durations, and
      // no youtube.com detour. yt-dlp only answers if that surface fails.
      let tracks: Track[] = [];
      let artists: ArtistSummary[] = [];
      try {
        const songs = await ytmSearchSongs(term, limit);
        tracks = songs.map(trackFromYtm);
        const byArtist = new Map<string, ArtistSummary>();
        for (const song of songs) {
          if (!song.artistId || !song.artist || byArtist.has(song.artistId)) continue;
          byArtist.set(song.artistId, {
            id: `youtube:${song.artistId}`,
            provider: "youtube",
            providerId: song.artistId,
            name: song.artist,
            artwork: song.artwork,
          });
        }
        artists = [...byArtist.values()].slice(0, 6);
      } catch {
        const music = await musicSearch(term, limit).catch(() => ({
          songs: [] as FlatEntry[],
          channels: [] as FlatEntry[],
        }));
        const flat = music.songs.length ? [] : await searchTracks(term, limit).catch(() => [] as FlatEntry[]);
        const seen = new Set<string>();
        for (const entry of [...music.songs, ...flat]) {
          const track = mapEntry(entry);
          if (track && !seen.has(track.id)) {
            seen.add(track.id);
            tracks.push(track);
          }
        }
        artists = music.channels.map((c) => ({
          id: `youtube:${c.id}`,
          provider: "youtube",
          providerId: c.id!,
          name: (c.title || "Unknown artist").replace(/\s*-\s*Topic$/, ""),
          artwork: bestThumb(c),
          verified: c.channel_is_verified,
        }));
      }
      return { tracks: await enrichMissing(tracks.slice(0, limit), 8), artists, albums: [] };
    });
  },

  async track(id) {
    return cached(`yt:track:${id}`, 10 * 60_000, async () => {
      const json = await ytdlp(["-J", `https://music.youtube.com/watch?v=${id}`]);
      const info = JSON.parse(json) as FullInfo;
      const parsed = splitTitle(info.track || info.title || "");
      const artist = artistFor(info, parsed.artist);
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
        ...artworkFor(info),
        playCount: info.view_count,
        releaseDate: year ? `${year}-01-01` : undefined,
        downloadable: false,
        streamable: true,
        permalink: `https://music.youtube.com/watch?v=${id}`,
      };
      return (await enrichMissing([track], 1))[0];
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
      await enrichMissing(tracks, 12);
      const byViews = [...tracks].sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0));
      const artist: Artist = {
        id: `youtube:${id}`,
        provider: "youtube",
        providerId: id,
        name: cleanArtistName(info.title || info.channel) || "Unknown artist",
        artwork: bestThumb(info) || tracks[0]?.artwork,
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

  async streamUrl(id, options) {
    const quality = options?.quality === "low" ? "low" : "high";
    const key = `yt:stream:${id}:${quality}`;
    // A cached URL can expire or be rejected; callers that saw a 403 ask for a
    // fresh resolution instead of failing the same track for the next minute.
    if (options?.fresh) cacheDelete(key);
    return cached(key, 5 * 60_000, async () => {
      // Low takes the smallest track the host is offered (audio-only when DASH
      // formats exist, the muxed one otherwise); high takes the best audio.
      const format = quality === "low" ? "worstaudio/worst" : "bestaudio/best";
      const urls = (
        await ytdlp(["-f", format, "-g", `https://music.youtube.com/watch?v=${id}`], 40_000)
      )
        .trim()
        .split("\n")
        .filter((line) => line.startsWith("http"));
      const url = urls[0];
      if (!url) throw new UpstreamError("YouTube did not return a playable stream");
      return url;
    });
  },
};
