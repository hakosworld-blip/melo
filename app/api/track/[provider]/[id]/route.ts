import { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string; id: string }> }) {
  const { provider: providerId, id } = await ctx.params;
  const provider = getProvider(providerId);
  if (provider.id !== providerId) {
    return Response.json({ error: "Unknown music source" }, { status: 404 });
  }
  try {
    const track = await provider.track(decodeURIComponent(id));
    if (!track) return Response.json({ error: "Track not found" }, { status: 404 });
    return Response.json({ track });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not load this track" },
      { status: 502 },
    );
  }
}
