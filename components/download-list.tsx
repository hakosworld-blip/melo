"use client";

import { AlertCircle, Check, Download, Loader2, Trash2 } from "lucide-react";
import { Artwork } from "@/components/artwork";
import { EmptyState } from "@/components/ui/primitives";
import { formatBytes } from "@/lib/format";
import { useTrackArtwork } from "@/lib/use-track-artwork";
import { useDownloads } from "@/store/downloads";
import { useUi } from "@/store/ui";
import { toast } from "@/store/toast";

export function totalDownloadBytes(record: {
  bytes: { audio: number; artwork: number; lyrics: number; metadata: number };
}) {
  return record.bytes.audio + record.bytes.artwork + record.bytes.lyrics + record.bytes.metadata;
}

export default function DownloadList({ showEmpty = true }: { showEmpty?: boolean }) {
  const records = useDownloads((s) => s.records);
  const order = useDownloads((s) => s.order);
  const retry = useDownloads((s) => s.retry);
  const cancel = useDownloads((s) => s.cancel);
  const remove = useDownloads((s) => s.remove);
  const openSheet = useUi((s) => s.openSheet);

  const items = order
    .map((id) => records[id])
    .filter(Boolean)
    .slice()
    .reverse();

  if (!items.length) {
    if (!showEmpty) return null;
    return (
      <EmptyState
        icon={<Download size={20} />}
        title="Nothing downloaded yet"
        description="Downloaded tracks keep audio, artwork, metadata and lyrics on this device — they play with no connection at all."
      />
    );
  }

  return (
    <div className="space-y-1">
      {items.map((record) => (
        <DownloadRow
          key={record.track.id}
          recordId={record.track.id}
          onRetry={() => retry(record.track.id)}
          onCancel={() => cancel(record.track.id)}
          onDelete={() =>
            openSheet({
              type: "confirm",
              title: "Delete download?",
              message: `“${record.track.title}” and its saved artwork, lyrics and metadata will be removed from this device.`,
              confirmLabel: "Delete",
              destructive: true,
              onConfirm: async () => {
                await remove(record.track.id);
                toast("Download deleted", "success");
              },
            })
          }
        />
      ))}
    </div>
  );
}

function DownloadRow({
  recordId,
  onRetry,
  onCancel,
  onDelete,
}: {
  recordId: string;
  onRetry: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const record = useDownloads((s) => s.records[recordId]);
  const artwork = useTrackArtwork(record?.track);
  if (!record) return null;
  const bytes = totalDownloadBytes(record);
  const active = record.status === "downloading" || record.status === "queued";

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]">
      <Artwork src={artwork} alt={record.track.title} className="h-10 w-10 shrink-0" rounded="rounded-[9px]" iconSize={14} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{record.track.title}</p>
        <p className="truncate text-[11.5px] text-muted">
          {record.track.artist} ·{" "}
          {active
            ? `${Math.round(record.progress * 100)}%`
            : record.status === "failed"
              ? record.error || "Failed"
              : `${formatBytes(bytes)}${record.authorised ? "" : " · offline copy"}`}
        </p>
        {active && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${record.progress * 100}%` }} />
          </div>
        )}
      </div>

      <span className="shrink-0 text-muted" aria-hidden="true">
        {record.status === "complete" ? (
          <Check size={15} className={record.hasSyncedLyrics ? "text-accent" : ""} />
        ) : active ? (
          <Loader2 size={15} className="anim-spin" />
        ) : (
          <AlertCircle size={15} className="text-[#f08c7e]" />
        )}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {record.status === "failed" && (
          <button onClick={onRetry} className="press rounded-full px-2 py-1 text-[11.5px] text-accent hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
            Retry
          </button>
        )}
        {active ? (
          <button onClick={onCancel} className="press rounded-full px-2 py-1 text-[11.5px] text-muted hover:text-ink">
            Cancel
          </button>
        ) : (
          <button
            onClick={onDelete}
            aria-label={`Delete download of ${record.track.title}`}
            className="press flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
