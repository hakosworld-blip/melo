import { NextRequest } from "next/server";
import { providers, providerIds } from "@/lib/provider";

export const dynamic = "force-dynamic";

/**
 * Which sources can actually stream from this host right now. The UI uses this
 * to explain failures instead of pretending a source works.
 */
export async function GET(req: NextRequest) {
  const check = req.nextUrl.searchParams.get("check") === "1";
  if (!check) {
    return Response.json({
      providers: providerIds.map((id) => ({ provider: id, label: providers[id].label })),
    });
  }
  const results = await Promise.all(providerIds.map((id) => providers[id].availability()));
  return Response.json({
    providers: results.map((r) => ({ ...r, label: providers[r.provider].label })),
  });
}
