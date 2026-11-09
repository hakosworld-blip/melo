import { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

/**
 * One genre's current tracks. Audius reports a genre per track, so this is a
 * real filter of the catalogue rather than a hand-picked list.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const provider = getProvider(searchParams.get("provider"));
  const genre = searchParams.get("genre")?.trim();
  if (!genre) return Response.json({ error: "genre is required" }, { status: 400 });
  if (!provider.genreTracks) {
    return Response.json(
      { error: `${provider.label} doesn't expose genres`, tracks: [] },
      { status: 501 },
    );
  }
  try {
    const tracks = await provider.genreTracks(genre, Number(searchParams.get("limit")) || 50);
    return Response.json({ provider: provider.id, genre, tracks });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not load this genre", tracks: [] },
      { status: 502 },
    );
  }
}
