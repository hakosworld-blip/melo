import type { ProviderId } from "@/lib/types";

/** Client-safe parsing of unified `${provider}:${id}` ids. */
export function splitId(raw: string): { provider: ProviderId; nativeId: string } {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* already decoded */
  }
  const [maybeProvider, ...rest] = decoded.split(":");
  if (maybeProvider === "youtube" && rest.length) {
    return { provider: maybeProvider, nativeId: rest.join(":") };
  }
  return { provider: "youtube", nativeId: decoded };
}

export function apiPath(kind: "artist" | "album" | "track", unifiedId: string) {
  const { provider, nativeId } = splitId(unifiedId);
  return `/api/${kind}/${provider}/${encodeURIComponent(nativeId)}`;
}
