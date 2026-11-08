"use client";

import { KEYS, hashUrl } from "@/lib/storage";
import { useAssetUrl } from "@/lib/use-asset-url";
import { useDownloads } from "@/store/downloads";
import type { Track } from "@/lib/types";

/**
 * Artwork for a track, preferring the locally stored copy for downloaded
 * tracks so the UI keeps its covers with no network at all.
 */
export function useTrackArtwork(track?: Track | null): string | undefined {
  const record = useDownloads((s) => (track ? s.records[track.id] : undefined));
  const hash = track?.artwork ? hashUrl(track.artwork) : undefined;
  const local = useAssetUrl(record?.status === "complete" && hash ? KEYS.artwork(hash) : undefined);
  return local || track?.artworkSmall || track?.artwork;
}
