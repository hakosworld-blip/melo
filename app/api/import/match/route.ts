import { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";
import { pickBestMatch, scoreCandidate, type MatchQuery } from "@/lib/match-import";

export const dynamic = "force-dynamic";

const MAX_BATCH = 12;
const CONCURRENCY = 4;

interface MatchRequest extends MatchQuery {}

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

  const results: { matched: unknown; score: number; failed: boolean }[] = new Array(queries.length);
  let cursor = 0;

  async function worker() {
    while (cursor < queries.length) {
      const index = cursor++;
      const query = queries[index];
      const search = query.artist ? `${query.title} ${query.artist}` : query.title;
      try {
        const found = await provider.search(search, 8);
        const matched = pickBestMatch(query, found.tracks);
        results[index] = { matched, score: matched ? scoreCandidate(query, matched) : 0, failed: false };
      } catch {
        results[index] = { matched: null, score: 0, failed: true };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queries.length) }, worker));
  return Response.json({ results });
}
