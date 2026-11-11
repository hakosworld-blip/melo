"use client";

import { Artwork } from "@/components/artwork";
import { Equalizer } from "@/components/track-row";
import { IconPlay } from "@/components/ui/icons";
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
      className={cn("group w-[150px] shrink-0 snap-start text-left sm:w-[168px]", className)}
      aria-label={`Play ${track.title}`}
    >
      <div className="relative overflow-hidden rounded-[6px]">
        <Artwork
          src={artwork}
          alt={track.title}
          rounded="rounded-[6px]"
          className="aspect-square w-full shadow-[var(--shadow-art)] transition-transform duration-[700ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.03]"
          iconSize={22}
        />
        <span
          className={cn(
            "cover-play transition-all duration-300",
            isActive && "opacity-100",
          )}
        >
          {isActive && playing ? <Equalizer playing /> : <IconPlay size={13} className="ml-[1px]" />}
        </span>
      </div>
      <p className={cn("mt-2 truncate text-[13px] font-medium leading-snug", isActive && "text-accent")}>
        {track.title}
      </p>
      <p className="mt-0.5 truncate text-[12px] text-muted">
        {[track.artist, track.album].filter(Boolean).join(" · ")}
      </p>
    </button>
  );
}
