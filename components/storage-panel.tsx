"use client";

import { useCallback, useEffect, useState } from "react";
import { Eraser, HardDrive, RefreshCw, Trash2 } from "lucide-react";
import DownloadList from "@/components/download-list";
import { Button, Skeleton } from "@/components/ui/primitives";
import { formatBytes } from "@/lib/format";
import {
  KEYS,
  assetSizes,
  clearAssetsByPrefix,
  hashUrl,
  idbDel,
  idbKeys,
  releaseAssetUrl,
  storageEstimate,
} from "@/lib/storage";
import { useDownloads } from "@/store/downloads";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";

/**
 * Storage: real numbers from IndexedDB + the browser's quota estimate.
 * Destructive actions always confirm, and caches never touch user content
 * (playlist covers, custom backgrounds) or downloaded artwork.
 */
export default function StoragePanel() {
  const records = useDownloads((s) => s.records);
  const removeAll = useDownloads((s) => s.removeAll);
  const openSheet = useUi((s) => s.openSheet);
  const [sizes, setSizes] = useState<Record<string, number> | null>(null);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setSizes(await assetSizes());
    setEstimate(await storageEstimate());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, records]);

  const downloadAudio = Object.values(records)
    .filter((r) => r.status === "complete")
    .reduce((sum, r) => sum + r.bytes.audio, 0);

  const categories = sizes
    ? [
        { key: "audio", label: "Downloaded music", bytes: sizes.audio, colour: "var(--accent)" },
        { key: "artwork", label: "Artwork", bytes: sizes.artwork, colour: "#8FBBFF" },
        { key: "lyrics", label: "Lyrics", bytes: sizes.lyrics, colour: "#7FDCC0" },
        { key: "metadata", label: "Metadata", bytes: sizes.metadata, colour: "#C2A6FF" },
        {
          key: "other",
          label: "Other cached data",
          bytes: sizes.other,
          colour: "color-mix(in srgb, var(--ink) 30%, transparent)",
        },
      ]
    : [];

  const total = categories.reduce((sum, category) => sum + category.bytes, 0);
  const downloaded = Object.values(records).filter((r) => r.status === "complete").length;
  const available = estimate ? Math.max(0, estimate.quota - estimate.usage) : null;

  const clearArtworkCache = async () => {
    const referenced = new Set(
      Object.values(records)
        .filter((record) => record.status === "complete" && record.track.artwork)
        .map((record) => hashUrl(record.track.artwork as string)),
    );
    const all = await idbKeys();
    const keys = all.filter((key) => {
      if (!key.startsWith("art:") && !key.startsWith("art-small:")) return false;
      const hash = key.replace(/^art(-small)?:/, "");
      return !referenced.has(hash);
    });
    await Promise.all(keys.map((key) => idbDel(key)));
    await refresh();
    toast(keys.length ? `Cleared ${keys.length} cached images` : "Artwork cache is already empty", "success");
  };

  const clearLyricCache = async () => {
    await clearAssetsByPrefix(["lyrics-cache:"]);
    await refresh();
    toast("Lyrics cache cleared", "success");
  };

  const clearTemp = async () => {
    await clearAssetsByPrefix(["lyrics-cache:"]);
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    await refresh();
    toast("Temporary cache cleared", "success");
  };

  const clearAllCaches = async () => {
    await clearAssetsByPrefix(["lyrics-cache:"]);
    await clearArtworkCache();
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    await refresh();
    toast("Caches cleared. Downloads are untouched.", "success");
  };

  return (
    <div className="space-y-5">
      <div className="surface px-4 py-4 sm:px-5">
        {!sizes ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-5">
              <div
                className="relative h-24 w-24 shrink-0 rounded-full"
                style={{
                  background:
                    total > 0
                      ? `conic-gradient(${buildConic(categories, total)})`
                      : "color-mix(in srgb, var(--ink) 8%, transparent)",
                }}
                aria-hidden="true"
              >
                <div className="absolute inset-[9px] flex flex-col items-center justify-center rounded-full bg-surface">
                  <span className="text-[13px] font-semibold tabular-nums">{formatBytes(total)}</span>
                  <span className="text-[9.5px] uppercase tracking-[0.1em] text-muted">in melo</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">Application storage</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                  {downloaded} downloaded {downloaded === 1 ? "track" : "tracks"} ·{" "}
                  {formatBytes(downloadAudio)} of audio
                  {available !== null ? ` · ${formatBytes(available)} available on this device` : ""}
                </p>
                <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => void refresh()}>
                  <RefreshCw size={13} /> Recalculate
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {categories.map((category) => {
                const pct = total > 0 ? (category.bytes / total) * 100 : 0;
                return (
                  <div key={category.key} className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category.colour }} />
                    <span className="flex-1 truncate text-[12px] text-ink/85">{category.label}</span>
                    <span className="w-10 text-right text-[11px] tabular-nums text-muted">{pct.toFixed(0)}%</span>
                    <span className="w-16 text-right text-[11.5px] tabular-nums">{formatBytes(category.bytes)}</span>
                  </div>
                );
              })}
            </div>
            {estimate && (
              <p className="mt-4 text-[10.5px] leading-relaxed text-muted">
                Browser quota: {formatBytes(estimate.usage)} used of {formatBytes(estimate.quota)}. melo only counts the
                files it owns; the quota includes the app shell and other origin data.
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="surface" disabled={busy} onClick={() => void clearArtworkCache()}>
          <Eraser size={13} /> Clear artwork cache
        </Button>
        <Button size="sm" variant="surface" disabled={busy} onClick={() => void clearLyricCache()}>
          <Eraser size={13} /> Clear lyrics cache
        </Button>
        <Button size="sm" variant="surface" disabled={busy} onClick={() => void clearTemp()}>
          <Eraser size={13} /> Clear temporary cache
        </Button>
        <Button
          size="sm"
          variant="surface"
          disabled={busy}
          onClick={() =>
            openSheet({
              type: "confirm",
              title: "Clear all caches?",
              message: "Cached artwork, searched lyrics and the offline app shell will be removed. Your downloads stay.",
              confirmLabel: "Clear caches",
              destructive: true,
              onConfirm: async () => {
                setBusy(true);
                try {
                  await clearAllCaches();
                } finally {
                  setBusy(false);
                }
              },
            })
          }
        >
          <Eraser size={13} /> Clear all caches
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={!downloaded || busy}
          onClick={() =>
            openSheet({
              type: "confirm",
              title: "Delete all downloads?",
              message: `This removes ${downloaded} downloaded ${downloaded === 1 ? "track" : "tracks"} with their audio, artwork, lyrics and metadata. Playlists and history stay.`,
              confirmLabel: "Delete everything",
              destructive: true,
              onConfirm: async () => {
                await removeAll();
                await refresh();
                toast("All downloads deleted", "success");
              },
            })
          }
        >
          <Trash2 size={13} /> Delete all downloads
        </Button>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-[12px] font-medium">
          <HardDrive size={14} className="text-muted" /> Downloaded songs
        </p>
        <div className="py-1">
          <DownloadList />
        </div>
      </div>
    </div>
  );
}

function buildConic(categories: { bytes: number; colour: string }[], total: number) {
  let cursor = 0;
  const stops: string[] = [];
  for (const category of categories) {
    if (!category.bytes) continue;
    const start = (cursor / total) * 100;
    cursor += category.bytes;
    const end = (cursor / total) * 100;
    stops.push(`${category.colour} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
  }
  return stops.join(", ");
}

export type { KEYS };
