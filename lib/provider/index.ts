import { audiusProvider } from "@/lib/provider/audius";
import { youtubeProvider } from "@/lib/provider/youtube";
import type { MusicProvider, ProviderId } from "@/lib/types";

/**
 * Provider registry. Adding a source means implementing MusicProvider and
 * registering it here — nothing in the UI or player needs to change.
 */

export const providers: Record<ProviderId, MusicProvider> = {
  audius: audiusProvider,
  youtube: youtubeProvider,
};

export const providerIds = Object.keys(providers) as ProviderId[];

export function isProviderId(value: string | null | undefined): value is ProviderId {
  return value === "audius" || value === "youtube";
}

export function getProvider(id: string | null | undefined): MusicProvider {
  if (isProviderId(id)) return providers[id];
  const fallback = process.env.MELO_PROVIDER;
  if (isProviderId(fallback)) return providers[fallback];
  return providers.audius;
}

/** Resolve `provider:id` unified ids. */
export function splitId(id: string): { provider: ProviderId; nativeId: string } {
  const [maybeProvider, ...rest] = id.split(":");
  if (isProviderId(maybeProvider) && rest.length) {
    return { provider: maybeProvider, nativeId: rest.join(":") };
  }
  return { provider: "audius", nativeId: id };
}

export function providerLabel(id: ProviderId): string {
  return providers[id].label;
}
