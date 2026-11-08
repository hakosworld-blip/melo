"use client";

import { Play } from "lucide-react";
import { Artwork } from "@/components/artwork";
import { Equalizer } from "@/components/track-row";
import { cn } from "@/lib/cn";
import { useProgress } from "@/lib/progress";
import { useTrackArtwork } from "@/lib/use-track-artwork";
import { usePlayer } from "@/store/player";
import type { Track } from "@/lib/types";

export default function TrackCard({
  track,
  context,
  index,
  className,
}: {
  track: Track;
  context: Track[];
  index: number;
  className?: string;
}) {
  const artwork = useTrackArtwork(track);
  const playTracks = usePlayer((s) => s.playTracks);
  const playTrack = usePlayer((s) => s.playTrack);
  const isActive = usePlayer((s) => s.queue[s.index]?.id === track.id);
  const playing = useProgress((s) => s.playing);

  return (
    <button
      onClick={() => (isActive ? playTrack(track) : playTracks(context, index))}
      className={cn("group w-[138px] shrink-0 snap-start text-left sm:w-[156px]", className)}
      aria-label={`Play ${track.title}`}
    >
      <div className="relative">
        <Artwork
          src={artwork}
          alt={track.title}
          className="aspect-square w-full shadow-[0_16px_36px_-24px_rgba(0,0,0,0.9)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.02]"
          iconSize={22}
        />
        <span
          className={cn(
            "press absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-all duration-300",
            isActive ? "opacity-100" : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
          )}
        >
          {isActive && playing ? <Equalizer playing /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
        </span>
      </div>
      <p className={cn("mt-2 truncate text-[13px] font-medium", isActive && "text-accent")}>{track.title}</p>
      <p className="truncate text-[11.5px] text-muted">{track.artist}</p>
    </button>
  );
}
