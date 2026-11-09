import { NextRequest } from "next/server";
import { fetchSpotifyPlaylist, parsePlaylistId } from "@/lib/spotify";
import { UpstreamError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return Response.json({ error: "Send a JSON body with a url." }, { status: 400 });
  }

  const raw = typeof body.url === "string" ? body.url : "";
  if (!raw.trim()) return Response.json({ error: "Paste a Spotify playlist link." }, { status: 400 });
  if (raw.length > 500) return Response.json({ error: "That link is too long." }, { status: 400 });

  const id = parsePlaylistId(raw);
  if (!id) {
    return Response.json(
      { error: "That is not a Spotify playlist link. Copy it with Share → Copy link to playlist." },
      { status: 400 },
    );
  }

  try {
    const playlist = await fetchSpotifyPlaylist(id);
    return Response.json({ playlist });
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Could not read that playlist.";
    return Response.json({ error: message }, { status });
  }
}
