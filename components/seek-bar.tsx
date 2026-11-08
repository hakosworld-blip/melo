"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { useProgress } from "@/lib/progress";
import { usePlayer } from "@/store/player";

export default function SeekBar({
  compact = false,
  className,
  showTimes = true,
  onSeekStart,
  onSeekEnd,
}: {
  compact?: boolean;
  className?: string;
  showTimes?: boolean;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}) {
  const progress = useProgress();
  const seek = usePlayer((s) => s.seek);
  const track = usePlayer((s) => s.queue[s.index]);
  const railRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const duration = progress.duration || track?.duration || 0;
  const position = dragging ? dragValue : progress.position;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, Math.max(0, (progress.buffered / duration) * 100)) : 0;

  const valueFromEvent = useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      if (!rail || !duration) return 0;
      const rect = rail.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onSeekStart?.();
    const value = valueFromEvent(event.clientX);
    setDragValue(value);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragValue(valueFromEvent(event.clientX));
  };

  const commit = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const value = valueFromEvent(event.clientX);
    setDragging(false);
    onSeekEnd?.();
    seek(value);
  };

  const remaining = Math.max(0, duration - position);

  return (
    <div className={cn("w-full select-none", className)}>
      <div
        className="seek-track"
        data-dragging={dragging}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={commit}
        onPointerCancel={() => {
          setDragging(false);
          onSeekEnd?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") seek(position + 5);
          if (event.key === "ArrowLeft") seek(position - 5);
          if (event.key === "Home") seek(0);
          if (event.key === "End") seek(duration);
        }}
      >
        <div className="seek-rail" ref={railRef}>
          <div className="seek-buffer" style={{ width: `${bufferedPct}%` }} />
          <div className="seek-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="seek-knob" style={{ left: `${pct}%` }} />
      </div>
      {showTimes && !compact && (
        <div className="mt-1 flex items-center justify-between text-[11.5px] tabular-nums text-muted">
          <span>{formatTime(position)}</span>
          <span>{formatTime(remaining)}</span>
        </div>
      )}
    </div>
  );
}
