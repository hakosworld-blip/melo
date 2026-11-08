import { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") || "").slice(0, 120);
  const provider = getProvider(searchParams.get("provider"));
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 40);
  if (!q.trim()) return Response.json({ tracks: [], artists: [], albums: [], provider: provider.id });
  try {
    const results = await provider.search(q, limit);
    return Response.json({ ...results, provider: provider.id });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Search failed", provider: provider.id },
      { status: 502 },
    );
  }
}
