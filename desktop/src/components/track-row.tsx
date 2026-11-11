"use client";

import { Artwork } from "@/components/artwork";
import { IconCheck, IconDownload, IconMore, IconPlay } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { useProgress } from "@/lib/progress";
import { useDownloads } from "@/store/downloads";
import { useTrackArtwork } from "@/lib/use-track-artwork";
import { usePlayer } from "@/store/player";
import { useUi } from "@/store/ui";
import type { Track } from "@/lib/types";

export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-[2.5px] rounded-full bg-accent", playing ? "eq-bar" : "")}
          style={{
            height: `${[10, 15, 7][i]}px`,
            animationDelay: `${i * 0.16}s`,
            transform: playing ? undefined : "scaleY(0.45)",
          }}
        />
      ))}
    </span>
  );
}

export default function TrackRow({
  track,
  index,
  context,
  showArtwork = true,
  showAlbum = false,
  showCoverNumber = false,
  onRemove,
  className,
  dense,
}: {
  track: Track;
  index: number;
  context: Track[];
  showArtwork?: boolean;
  showAlbum?: boolean;
  showCoverNumber?: boolean;
  onRemove?: () => void;
  className?: string;
  dense?: boolean;
}) {
  const current = usePlayer((s) => s.queue[s.index]);
  const playTracks = usePlayer((s) => s.playTracks);
  const playTrack = usePlayer((s) => s.playTrack);
  const openSheet = useUi((s) => s.openSheet);
  const download = useDownloads((s) => s.records[track.id]);
  const artworkUrl = useTrackArtwork(track);
  const playing = useProgress((s) => s.playing);
  const isActive = current?.id === track.id;

  return (
    <div
      data-active={isActive}
      className={cn("list-row group", className)}
    >
      {showCoverNumber ? (
        <div className="relative flex w-5 shrink-0 items-center justify-center">
          <span className={cn("text-[12px] tabular-nums text-muted group-hover:opacity-0", isActive && "opacity-0")}>
            {index + 1}
          </span>
          <button
            onClick={() => playTracks(context, index)}
            aria-label={`Play ${track.title}`}
            className="press focus-ring absolute inset-0 flex items-center justify-center text-ink opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <IconPlay size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            if (isActive) playTrack(track);
            else playTracks(context, index);
          }}
          aria-label={`Play ${track.title}`}
          className="relative shrink-0 overflow-hidden rounded-[6px]"
        >
          {showArtwork ? (
            <Artwork
              src={artworkUrl}
              alt={track.title}
              className={cn("h-11 w-11", dense && "h-10 w-10")}
              rounded="rounded-[6px]"
              iconSize={16}
            />
          ) : (
            <div className="h-10 w-10 rounded-[6px] bg-surface2" />
          )}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity",
              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {isActive && playing ? <Equalizer playing /> : <IconPlay size={14} />}
          </span>
        </button>
      )}

      <button
        onClick={() => {
          if (isActive) playTrack(track);
          else playTracks(context, index);
        }}
        className="min-w-0 flex-1 text-left"
      >
        <p className={cn("truncate text-[14px] font-medium leading-[1.32]", isActive && "text-accent")}>
          {track.title}
        </p>        <p className="mt-0.5 truncate text-[12px] leading-[1.3] text-muted">
          {[track.artist, showAlbum ? track.album : undefined].filter(Boolean).join(" · ")}
          {showAlbum && track.featuredArtists.length > 0 && (
            <span className="hidden sm:inline"> · feat. {track.featuredArtists.join(", ")}</span>
          )}
        </p>
      </button>

      {download?.status === "complete" && (
        <span title={download.authorised ? "Downloaded" : "Saved offline"} className="hidden text-muted sm:block">
          {download.authorised ? <IconDownload size={14} /> : <IconCheck size={14} />}
        </span>
      )}

      <span className="hidden w-10 text-right text-[12px] tabular-nums text-muted sm:block">
        {formatTime(track.duration)}
      </span>

      <button
        aria-label={`More options for ${track.title}`}
        onClick={() => openSheet({ type: "trackMenu", track })}
        className="press focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted/80 hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)] hover:text-ink"
      >
        <IconMore size={16} />
      </button>

      {onRemove && (
        <button
          onClick={onRemove}
          className="press focus-ring ml-1 rounded-full px-2 py-1 text-[11.5px] text-muted hover:text-ink"
        >
          Remove
        </button>
      )}
    </div>
  );
}
