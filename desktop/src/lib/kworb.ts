import { cached } from "@/lib/cache";
import { normalise, UpstreamError } from "@/lib/http";

/**
 * kworb.net statistics.
 *
 * kworb publishes Spotify aggregates as plain HTML tables: a leaderboard by
 * monthly listeners, a per-artist page with total and daily streams, and the
 * global daily chart. There is no API, so this reads the same pages a person
 * would, with a long cache so melo asks once rather than once per view.
 *
 * The data is Spotify's; anything shown in the UI says so.
 */

const BASE = "https://kworb.net";
const UA = "melo/1.0 (+https://github.com/hakosworld-blip/melo)";
const SIX_HOURS = 6 * 60 * 60 * 1000;

async function page(path: string, key: string, ttl = SIX_HOURS): Promise<string> {
  return cached(`kworb:${key}`, ttl, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${BASE}${path}`, {
        signal: controller.signal,
        headers: { accept: "text/html", "user-agent": UA },
        cache: "no-store",
      });
      if (!res.ok) throw new UpstreamError(`kworb.net responded ${res.status}`, 502);
      return await res.text();
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError("kworb.net is unreachable", 502);
    } finally {
      clearTimeout(timer);
    }
  });
}

const toNumber = (value: string) => {
  const parsed = Number(value.replace(/[^0-9-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const strip = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Every table row as an array of raw cell html. */
function tableRows(html: string): string[][] {
  const out: string[][] = [];
  for (const row of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]);
    if (cells.length) out.push(cells);
  }
  return out;
}

export interface ChartArtist {
  name: string;
  kworbId: string;
  /** Rank by monthly listeners, worldwide. */
  rank: number;
  monthlyListeners: number;
  /** Change in monthly listeners since yesterday. */
  dailyChange: number;
  peakRank: number;
  peakListeners: number;
}

export interface WorldwidePosition {
  position: number;
  title: string;
  streams: number;
}

export interface ArtistStats extends ChartArtist {
  totalStreams: number;
  dailyStreams: number;
  trackCount: number;
  worldwide: WorldwidePosition[];
  updated: string | null;
}

/** The leaderboard kworb refreshes for every artist it tracks. */
async function leaderboard(): Promise<ChartArtist[]> {
  const html = await page("/spotify/listeners.html", "listeners");
  const artists: ChartArtist[] = [];
  for (const cells of tableRows(html)) {
    if (cells.length < 6) continue;
    const link = cells[1].match(/href="artist\/([^"]+?)_songs\.html"[^>]*>([^<]+)</);
    if (!link) continue;
    const rank = toNumber(strip(cells[0]));
    if (!rank) continue;
    artists.push({
      name: strip(link[2]),
      kworbId: link[1],
      rank,
      monthlyListeners: toNumber(strip(cells[2])),
      dailyChange: toNumber(strip(cells[3])),
      peakRank: toNumber(strip(cells[4])),
      peakListeners: toNumber(strip(cells[5])),
    });
  }
  return artists;
}

/** Global daily chart, grouped by artist name. */
async function globalChart(): Promise<{ updated: string | null; byArtist: Map<string, WorldwidePosition[]> }> {
  const html = await page("/spotify/country/global_daily.html", "global", 30 * 60_000);
  const updated = html.match(/(\d{4}\/\d{2}\/\d{2})/)?.[1] ?? null;
  const byArtist = new Map<string, WorldwidePosition[]>();
  for (const cells of tableRows(html)) {
    if (cells.length < 7) continue;
    const position = toNumber(strip(cells[0]));
    if (!position) continue;
    const links = [...cells[2].matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((m) => strip(m[1]));
    if (links.length < 2) continue;
    const key = normalise(links[0]);
    if (!key) continue;
    const entry: WorldwidePosition = { position, title: links[1], streams: toNumber(strip(cells[6])) };
    const list = byArtist.get(key);
    if (list) list.push(entry);
    else byArtist.set(key, [entry]);
  }
  return { updated, byArtist };
}

/**
 * A YouTube channel name is not always the name kworb lists ("- Topic"
 * suffixes, legal names, stylised punctuation), so match generously but never
 * silently: no match means no stats rather than the wrong artist's numbers.
 */
function matchArtist(all: ChartArtist[], rawName: string): ChartArtist | null {
  const target = normalise(rawName.replace(/\s*-\s*Topic$/i, "").trim());
  if (!target) return null;
  return (
    all.find((artist) => normalise(artist.name) === target) ??
    all.find((artist) => {
      const name = normalise(artist.name);
      return target.length >= 4 && name.startsWith(target);
    }) ??
    all.find((artist) => {
      const name = normalise(artist.name);
      return name.length >= 5 && target.includes(name);
    }) ??
    null
  );
}

export async function artistStats(rawName: string): Promise<ArtistStats | null> {
  const all = await leaderboard();
  const base = matchArtist(all, rawName);
  if (!base) return null;

  const [html, global] = await Promise.all([
    page(`/spotify/artist/${base.kworbId}_songs.html`, `artist:${base.kworbId}`),
    globalChart(),
  ]);

  const total = (label: string) => {
    const match = html.match(new RegExp(`<td class="text">${label}</td><td>([\\d,]+)</td>`));
    return match ? toNumber(match[1]) : 0;
  };

  const worldwide = [...(global.byArtist.get(normalise(base.name)) ?? [])].sort((a, b) => a.position - b.position);

  return {
    ...base,
    totalStreams: total("Streams"),
    dailyStreams: total("Daily"),
    trackCount: total("Tracks"),
    worldwide,
    updated: html.match(/Last updated:\s*(\d{4}\/\d{2}\/\d{2})/)?.[1] ?? global.updated,
  };
}

export interface TopArtist extends ChartArtist {
  worldwide: { position: number; title: string } | null;
}

export async function topArtists(limit = 20): Promise<{ source: string; updated: string | null; artists: TopArtist[] }> {
  const [all, global] = await Promise.all([leaderboard(), globalChart()]);
  const artists = all.slice(0, limit).map((artist) => {
    const entries = global.byArtist.get(normalise(artist.name)) ?? [];
    const best = entries.reduce<WorldwidePosition | null>(
      (lowest, entry) => (lowest === null || entry.position < lowest.position ? entry : lowest),
      null,
    );
    return { ...artist, worldwide: best ? { position: best.position, title: best.title } : null };
  });
  return { source: "kworb.net", updated: global.updated, artists };
}
