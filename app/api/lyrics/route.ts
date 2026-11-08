import { NextRequest } from "next/server";
import { findLyrics, searchLyrics } from "@/lib/lyrics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q");
  try {
    if (query) {
      const results = await searchLyrics(query);
      return Response.json({ results, source: "LRCLIB" });
    }
    const title = searchParams.get("title") || "";
    const artist = searchParams.get("artist") || "";
    const album = searchParams.get("album") || undefined;
    const duration = Number(searchParams.get("duration")) || undefined;
    if (!title) return Response.json({ error: "title is required" }, { status: 400 });
    const lyrics = await findLyrics({ title, artist, album, duration });
    return Response.json({ lyrics, source: "LRCLIB" });
  } catch {
    return Response.json({ error: "Lyrics lookup failed", lyrics: null }, { status: 502 });
  }
}
