"use client";

import { ChevronUp, ListMusic, Pause, Play, SkipForward } from "lucide-react";
import { Artwork } from "@/components/artwork";
import { useProgress } from "@/lib/progress";
import { useTrackArtwork } from "@/lib/use-track-artwork";
import { usePlayer } from "@/store/player";
import { useUi } from "@/store/ui";

export default function MiniPlayer() {
  const track = usePlayer((s) => s.queue[s.index]);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const openNowPlaying = useUi((s) => s.openNowPlaying);
  const openSheet = useUi((s) => s.openSheet);
  const progress = useProgress();
  const artworkUrl = useTrackArtwork(track);

  if (!track) return null;
  const duration = progress.duration || track.duration || 0;
  const pct = duration ? Math.min(100, (progress.position / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-40 lg:bottom-0 lg:left-[248px]">
      <div className="chrome relative border-t border-line shadow-[0_-18px_34px_-30px_rgba(0,0,0,0.95)]">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]">
          <div
            className="h-full bg-accent transition-[width] duration-300 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mx-auto flex h-[62px] max-w-[1600px] items-center gap-3 px-3 sm:px-5">
          <button
            onClick={openNowPlaying}
            className="press focus-ring group flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
            aria-label="Open now playing"
          >
            <Artwork
              src={artworkUrl}
              alt={track.title}
              className="h-10 w-10 shrink-0 transition-transform duration-300 group-hover:scale-[1.03]"
              rounded="rounded-[9px]"
              iconSize={15}
              eager
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight">{track.title}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-muted">{track.artist}</p>
            </div>
            <ChevronUp size={15} className="ml-1 hidden shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 sm:block" />
          </button>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={toggle}
              aria-label={progress.playing ? "Pause" : "Play"}
              className="press focus-ring flex h-10 w-10 items-center justify-center rounded-full bg-ink text-bg transition-transform"
            >
              {progress.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              onClick={() => next()}
              aria-label="Next track"
              className="press focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink/80 hover:text-ink"
            >
              <SkipForward size={16} fill="currentColor" />
            </button>
            <button
              onClick={() => openSheet({ type: "queue" })}
              aria-label="Queue"
              className="press focus-ring hidden h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:text-ink sm:flex"
            >
              <ListMusic size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
