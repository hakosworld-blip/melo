import { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ provider: string; id: string }> }) {
  const { provider: providerId, id } = await ctx.params;
  const provider = getProvider(providerId);
  try {
    const album = await provider.album(decodeURIComponent(id));
    if (!album) return Response.json({ error: "Album not found" }, { status: 404 });
    return Response.json({ album });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not load this album" },
      { status: 502 },
    );
  }
}
