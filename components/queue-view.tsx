"use client";

import { useRef, useState } from "react";
import { GripVertical, ListPlus, Trash2, X } from "lucide-react";
import { Artwork } from "@/components/artwork";
import { Button, EmptyState } from "@/components/ui/primitives";
import { Equalizer } from "@/components/track-row";
import { cn } from "@/lib/cn";
import { formatDurationLong, formatTime } from "@/lib/format";
import { useProgress } from "@/lib/progress";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";

export default function QueueView() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playAt = usePlayer((s) => s.playAt);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const moveInQueue = usePlayer((s) => s.moveInQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const closeSheet = useUi((s) => s.closeSheet);
  const playing = useProgress((s) => s.playing);

  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  const indexAt = (clientY: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-queue-row]");
    if (!rows) return -1;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
    return -1;
  };

  const total = queue.reduce((sum, track) => sum + (track.duration || 0), 0);

  if (!queue.length) {
    return (
      <EmptyState
        icon={<ListPlus size={20} />}
        title="Your queue is empty"
        description="Play something, or add tracks with “Add to queue” from any song's menu."
      />
    );
  }

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-3 pb-3">
        <p className="text-[11.5px] text-muted">
          {queue.length} {queue.length === 1 ? "song" : "songs"} · {formatDurationLong(total)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const tracks = [...queue];
              const id = createPlaylist(`Queue · ${new Date().toLocaleDateString()}`, tracks);
              toast(`Saved ${tracks.length} songs as a playlist`, "success", {
                label: "Open",
                run: () => {
                  closeSheet();
                  window.location.href = `/playlist/${id}`;
                },
              });
            }}
          >
            Save as playlist
          </Button>
          <Button size="sm" variant="ghost" onClick={() => clearQueue()}>
            Clear
          </Button>
        </div>
      </div>

      <div ref={listRef} className="space-y-0.5">
        {queue.map((track, rowIndex) => {
          const isCurrent = rowIndex === index;
          const isDragging = drag?.from === rowIndex;
          const isTarget = drag?.over === rowIndex && drag.from !== rowIndex;
          return (
            <div
              key={`${track.id}-${rowIndex}`}
              data-queue-row
              className={cn(
                "flex items-center gap-2 rounded-xl py-1.5 pl-1 pr-2 transition-colors",
                isCurrent && "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]",
                isDragging && "opacity-50",
                isTarget && "ring-1 ring-accent/60",
              )}
            >
              <button
                aria-label={`Reorder ${track.title}`}
                className="press flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted touch-none active:cursor-grabbing"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDrag({ from: rowIndex, over: rowIndex });
                }}
                onPointerMove={(event) => {
                  if (!drag) return;
                  const over = indexAt(event.clientY);
                  if (over >= 0 && over !== drag.over) setDrag({ from: drag.from, over });
                }}
                onPointerUp={() => {
                  if (drag && drag.over !== drag.from) moveInQueue(drag.from, drag.over);
                  setDrag(null);
                }}
                onPointerCancel={() => setDrag(null)}
              >
                <GripVertical size={15} />
              </button>

              <button
                onClick={() => playAt(rowIndex)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <Artwork
                  src={track.artworkSmall || track.artwork}
                  alt={track.title}
                  className="h-9 w-9 shrink-0"
                  rounded="rounded-[8px]"
                  iconSize={14}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{track.title}</p>
                  <p className="truncate text-[11px] text-muted">{track.artist}</p>
                </div>
              </button>

              {isCurrent ? (
                <span className="flex w-8 items-center justify-center text-accent">
                  <Equalizer playing={playing} />
                </span>
              ) : (
                <span className="w-8 text-right text-[11px] tabular-nums text-muted">{formatTime(track.duration)}</span>
              )}

              <button
                aria-label={`Remove ${track.title} from queue`}
                onClick={() => removeFromQueue(rowIndex)}
                className="press flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 px-3">
        <button
          onClick={() => clearQueue()}
          className="press flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12px] text-muted hover:text-ink"
        >
          <Trash2 size={14} /> Clear queue
        </button>
      </div>
    </div>
  );
}
