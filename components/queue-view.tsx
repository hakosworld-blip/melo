"use client";

import { useRef, useState } from "react";
import { Artwork } from "@/components/artwork";
import { EmptyState } from "@/components/ui/primitives";
import { Equalizer } from "@/components/track-row";
import {
  IconClose,
  IconGrip,
  IconMusic,
  IconPause,
  IconPlay,
  IconTrash,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatDurationLong, formatTime } from "@/lib/format";
import { useProgress } from "@/lib/progress";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";
import type { Track } from "@/lib/types";

/** What "Up next" promises: the songs that follow this one, in order. */
const UP_NEXT = 15;

export default function QueueView() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playAt = usePlayer((s) => s.playAt);
  const toggle = usePlayer((s) => s.toggle);
  const removeFromQueue = usePlayer((s) => s.removeFromQueue);
  const moveInQueue = usePlayer((s) => s.moveInQueue);
  const clearQueue = usePlayer((s) => s.clearQueue);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const closeSheet = useUi((s) => s.closeSheet);
  const playing = useProgress((s) => s.playing);

  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const current = index >= 0 ? queue[index] : undefined;
  const upcoming = queue.slice(index + 1);
  const shown = showAll ? upcoming : upcoming.slice(0, UP_NEXT);
  const hiddenCount = upcoming.length - shown.length;

  const indexAt = (clientY: number) => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-queue-row]");
    if (!rows) return -1;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
    return -1;
  };

  if (!queue.length) {
    return (
      <EmptyState
        icon={<IconMusic size={20} />}
        title="Nothing queued"
        description="Play a song, or choose “Add to queue” from any track's menu."
      />
    );
  }

  const total = queue.reduce((sum, track) => sum + (track.duration || 0), 0);

  return (
    <div className="pb-4">
      {current && (
        <section className="px-2">
          <p className="px-1 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">Playing</p>
          <div className="flex items-center gap-3 rounded-lg bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] px-2 py-2">
            <button
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className="press focus-ring relative h-11 w-11 shrink-0 overflow-hidden rounded-[6px]"
            >
              <Artwork
                src={current.artworkSmall || current.artwork}
                alt={current.title}
                className="h-11 w-11"
                rounded="rounded-[6px]"
                iconSize={16}
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                {playing ? <Equalizer playing /> : <IconPlay size={14} />}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{current.title}</p>
              <p className="truncate text-[12px] text-muted">{current.artist}</p>
            </div>
            <button
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className="press focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)]"
            >
              {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
            </button>
          </div>
        </section>
      )}

      <section className="mt-5 px-2">
        <div className="flex items-baseline justify-between px-1 pb-1.5">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">
            Up next
            {upcoming.length > 0 &&
              (hiddenCount > 0 ? ` · ${shown.length} of ${upcoming.length}` : ` · ${upcoming.length}`)}
          </p>
          <p className="text-[11px] tabular-nums text-muted">{formatDurationLong(total)} total</p>
        </div>

        {upcoming.length === 0 ? (
          <p className="px-1 py-6 text-[13px] text-muted">
            This is the last song in the queue. Add something from any track&apos;s menu to keep going.
          </p>
        ) : (
          <div ref={listRef}>
            {shown.map((track, rowIndex) => {
              const absoluteIndex = index + 1 + rowIndex;
              const isDragging = drag?.from === absoluteIndex;
              const isTarget = drag?.over === absoluteIndex && drag.from !== absoluteIndex;
              return (
                <QueueRow
                  key={`${track.id}-${absoluteIndex}`}
                  track={track}
                  position={rowIndex + 1}
                  dragging={isDragging}
                  target={isTarget}
                  onPlay={() => playAt(absoluteIndex)}
                  onRemove={() => removeFromQueue(absoluteIndex)}
                  onDragStart={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDrag({ from: absoluteIndex, over: absoluteIndex });
                  }}
                  onDragMove={(event) => {
                    if (!drag) return;
                    const overRow = indexAt(event.clientY);
                    if (overRow < 0) return;
                    const over = index + 1 + overRow;
                    if (over !== drag.over) setDrag({ from: drag.from, over });
                  }}
                  onDragEnd={() => {
                    if (drag && drag.over !== drag.from) moveInQueue(drag.from, drag.over);
                    setDrag(null);
                  }}
                />
              );
            })}
          </div>
        )}

        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="press focus-ring mt-2 w-full rounded-lg px-2 py-2 text-left text-[12.5px] font-medium text-muted hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink"
          >
            Show {hiddenCount} more in the queue
          </button>
        )}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2 px-3">
        <button
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
          className="press focus-ring rounded-full border border-line px-3.5 py-2 text-[12.5px] font-medium text-ink/85 hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]"
        >
          Save as playlist
        </button>
        {confirmClear ? (
          <span className="flex items-center gap-2">
            <button
              onClick={() => {
                clearQueue();
                setConfirmClear(false);
                closeSheet();
              }}
              className="press focus-ring rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-[var(--bg)]"
            >
              Clear {queue.length} songs
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="press focus-ring rounded-full px-2.5 py-2 text-[12.5px] text-muted hover:text-ink"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="press focus-ring flex items-center gap-1.5 rounded-full border border-line px-3.5 py-2 text-[12.5px] text-muted hover:text-ink"
          >
            <IconTrash size={14} /> Clear queue
          </button>
        )}
      </div>
    </div>
  );
}

function QueueRow({
  track,
  position,
  dragging,
  target,
  onPlay,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  track: Track;
  position: number;
  dragging: boolean;
  target: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onDragStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      data-queue-row
      className={cn(
        "group flex items-center gap-2.5 rounded-lg py-1.5 pl-1 pr-1.5 transition-colors",
        "hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
        dragging && "opacity-50",
        target && "ring-1 ring-ink/40",
      )}
    >
      <button
        aria-label={`Reorder ${track.title}`}
        className="press flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted/60 touch-none hover:text-ink active:cursor-grabbing sm:w-6"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <IconGrip size={14} />
      </button>

      <button onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="w-4 shrink-0 text-center text-[11.5px] tabular-nums text-muted">{position}</span>
        <Artwork
          src={track.artworkSmall || track.artwork}
          alt={track.title}
          className="h-10 w-10 shrink-0"
          rounded="rounded-[5px]"
          iconSize={14}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium leading-[1.3]">{track.title}</p>
          <p className="truncate text-[11.5px] text-muted">{track.artist}</p>
        </div>
      </button>

      <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-muted">
        {formatTime(track.duration)}
      </span>

      <button
        aria-label={`Remove ${track.title} from queue`}
        onClick={onRemove}
        className="press focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)] hover:text-ink"
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}
