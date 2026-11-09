import { NextRequest } from "next/server";
import { parseYoutubePlaylistId, readYoutubePlaylist } from "@/lib/youtube-import";
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
  if (!raw.trim()) return Response.json({ error: "Paste a YouTube Music playlist link." }, { status: 400 });
  if (raw.length > 500) return Response.json({ error: "That link is too long." }, { status: 400 });

  const id = parseYoutubePlaylistId(raw);
  if (!id) {
    return Response.json(
      { error: "That is not a YouTube playlist link. Open the playlist and copy the address, including ?list=…" },
      { status: 400 },
    );
  }

  try {
    const playlist = await readYoutubePlaylist(id);
    return Response.json({ playlist });
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Could not read that playlist.";
    return Response.json({ error: message }, { status });
  }
}
