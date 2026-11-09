import { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";
import { youtubeSearchTracks } from "@/lib/provider/youtube";
import {
  pickBestMatch,
  pickYoutubeMatch,
  scoreCandidate,
  type MatchQuery,
} from "@/lib/match-import";
import type { ProviderId, Track } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BATCH = 12;

interface MatchRequest extends MatchQuery {}

interface MatchResult {
  matched: Track | null;
  score: number;
  source: ProviderId | null;
  failed: boolean;
}

function readQuery(value: unknown): MatchRequest | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const title = typeof entry.title === "string" ? entry.title.trim().slice(0, 160) : "";
  if (!title) return null;
  return {
    title,
    artist: typeof entry.artist === "string" ? entry.artist.trim().slice(0, 160) : "",
    duration: typeof entry.duration === "number" && Number.isFinite(entry.duration) ? entry.duration : 0,
  };
}

export async function POST(req: NextRequest) {
  let body: { tracks?: unknown };
  try {
    body = (await req.json()) as { tracks?: unknown };
  } catch {
    return Response.json({ error: "Send a JSON body with tracks." }, { status: 400 });
  }

  const incoming = Array.isArray(body.tracks) ? body.tracks.slice(0, MAX_BATCH) : [];
  const queries = incoming.map(readQuery).filter((query): query is MatchRequest => Boolean(query));
  if (!queries.length) return Response.json({ results: [] });

  const provider = getProvider(req.nextUrl.searchParams.get("provider"));
  const youtube = getProvider("youtube");
  const wantsFallback = req.nextUrl.searchParams.get("fallback") !== "none" && provider.id !== "youtube";
  // A cached probe: if yt-dlp is missing or YouTube is blocking this host, songs
  // without a catalogue match are reported as missing instead of stalling.
  const youtubeReady = wantsFallback ? (await youtube.availability()).available : false;

  const results: MatchResult[] = new Array(queries.length);
  const concurrency = youtubeReady ? 3 : 4;
  let cursor = 0;

  async function worker() {
    while (cursor < queries.length) {
      const index = cursor++;
      const query = queries[index];
      const search = query.artist ? `${query.title} ${query.artist}` : query.title;
      try {
        const found = await provider.search(search, 8);
        let matched = pickBestMatch(query, found.tracks);
        if (matched) {
          results[index] = { matched, score: scoreCandidate(query, matched), source: provider.id, failed: false };
          continue;
        }
        if (youtubeReady) {
          const viaYoutube = await youtubeSearchTracks(search, 6).catch(() => [] as Track[]);
          const hit = viaYoutube.length ? pickYoutubeMatch(query, viaYoutube) : null;
          if (hit) {
            results[index] = { matched: hit, score: scoreCandidate(query, hit), source: "youtube", failed: false };
            continue;
          }
        }
        results[index] = { matched: null, score: 0, source: null, failed: false };
      } catch {
        results[index] = { matched: null, score: 0, source: null, failed: true };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queries.length) }, worker));
  return Response.json({ results });
}
