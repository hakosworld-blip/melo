import { youtubeProvider } from "@/lib/provider/youtube";
import type { MusicProvider, ProviderId } from "@/lib/types";

/**
 * melo has one music source: YouTube Music. The provider interface stays so the
 * engine, player and UI keep talking to an abstraction instead of yt-dlp
 * directly, but there is nothing to choose and no fallback catalogue.
 */

export const providers: Record<ProviderId, MusicProvider> = {
  youtube: youtubeProvider,
};

export const providerIds = Object.keys(providers) as ProviderId[];

export function isProviderId(value: string | null | undefined): value is ProviderId {
  return value === "youtube";
}

export function getProvider(id: string | null | undefined): MusicProvider {
  if (isProviderId(id)) return providers[id];
  return providers.youtube;
}

/** Resolve `provider:id` unified ids. */
export function splitId(id: string): { provider: ProviderId; nativeId: string } {
  const [maybeProvider, ...rest] = id.split(":");
  if (isProviderId(maybeProvider) && rest.length) {
    return { provider: maybeProvider, nativeId: rest.join(":") };
  }
  return { provider: "youtube", nativeId: id };
}

export function providerLabel(id: ProviderId): string {
  return providers[id].label;
}
