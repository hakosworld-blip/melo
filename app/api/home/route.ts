import { NextRequest } from "next/server";
import { buildHomeFeed } from "@/lib/feed";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

function list(value: string | null, max: number): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, max);
}

export async function GET(req: NextRequest) {
  const provider = getProvider(req.nextUrl.searchParams.get("provider"));
  const { searchParams } = req.nextUrl;
  try {
    const feed = await buildHomeFeed(provider, {
      day: searchParams.get("day") ?? undefined,
      seeds: {
        artists: list(searchParams.get("artists"), 6),
        genres: list(searchParams.get("genres"), 6),
      },
    });
    return Response.json({ provider: provider.id, ...feed });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not load music", provider: provider.id },
      { status: 502 },
    );
  }
}
