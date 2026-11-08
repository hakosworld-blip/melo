import { NextRequest } from "next/server";
import { getProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const provider = getProvider(req.nextUrl.searchParams.get("provider"));
  try {
    const sections = await provider.home();
    return Response.json({ provider: provider.id, sections });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not load music", provider: provider.id },
      { status: 502 },
    );
  }
}
