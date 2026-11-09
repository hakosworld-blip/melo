"use client";

import { Artwork } from "@/components/artwork";
import { IconNext, IconPause, IconPlay, IconQueue } from "@/components/ui/icons";
import { useProgress } from "@/lib/progress";
import { useTrackArtwork } from "@/lib/use-track-artwork";
import { usePlayer } from "@/store/player";
import { useUi } from "@/store/ui";

/**
 * The floating now-playing capsule. It sits above the tab pill on phones and
 * along the bottom on desktop, always showing where you are in the song.
 */
export default function MiniPlayer() {
  const track = usePlayer((s) => s.queue[s.index]);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const openNowPlaying = useUi((s) => s.openNowPlaying);
  const openSheet = useUi((s) => s.openSheet);
  const sheetOpen = useUi((s) => s.sheet !== null);
  const progress = useProgress();
  const artworkUrl = useTrackArtwork(track);

  if (!track || sheetOpen) return null;
  const duration = progress.duration || track.duration || 0;
  const pct = duration ? Math.min(100, (progress.position / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(75px+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-2 lg:left-[248px] lg:px-2">
      <div className="glass-strong relative mx-auto flex h-[58px] max-w-4xl items-center gap-1.5 overflow-hidden rounded-[16px] px-2 shadow-[0_20px_50px_-26px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[color-mix(in_srgb,var(--ink)_9%,transparent)]">
          <div className="h-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
        </div>

        <button
          onClick={openNowPlaying}
          className="press group flex min-w-0 flex-1 items-center gap-2.5 rounded-[12px] py-1 pl-0.5 text-left"
          aria-label="Open now playing"
        >
          <Artwork
            src={artworkUrl}
            alt={track.title}
            className="h-10 w-10 shrink-0"
            rounded="rounded-[5px]"
            iconSize={15}
            eager
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight">{track.title}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted">{track.artist}</p>
          </div>
        </button>

        <button
          onClick={() => openSheet({ type: "queue" })}
          aria-label="Up next"
          className="press focus-ring hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)] hover:text-ink sm:flex"
        >
          <IconQueue size={18} />
        </button>
        <button
          onClick={toggle}
          aria-label={progress.playing ? "Pause" : "Play"}
          className="press focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)]"
        >
          {progress.playing ? <IconPause size={19} /> : <IconPlay size={19} />}
        </button>
        <button
          onClick={() => next()}
          aria-label="Next track"
          className="press focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/85 hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)] hover:text-ink"
        >
          <IconNext size={19} />
        </button>
      </div>
    </div>
  );
}
