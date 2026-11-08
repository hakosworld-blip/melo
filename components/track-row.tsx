"use client";

import Link from "next/link";
import { Check, Download, MoreHorizontal, Play } from "lucide-react";
import { Artwork } from "@/components/artwork";
import { cn } from "@/lib/cn";
import { formatCount, formatTime } from "@/lib/format";
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
      className={cn(
        "group relative flex items-center gap-3 rounded-[calc(var(--radius)-4px)] pr-1 pl-2 row-pad",
        "transition-colors duration-200",
        isActive ? "bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--ink)_4.5%,transparent)]",
        className,
      )}
    >
      {showCoverNumber ? (
        <div className="relative flex w-8 shrink-0 items-center justify-center">
          <span className="text-[12.5px] tabular-nums text-muted group-hover:opacity-0">
            {isActive && !showArtwork ? <Equalizer playing={playing} /> : (index + 1).toString().padStart(2, "0")}
          </span>
          <button
            onClick={() => playTracks(context, index)}
            aria-label={`Play ${track.title}`}
            className="press absolute inset-0 flex items-center justify-center rounded-full text-ink opacity-0 transition-opacity group-hover:opacity-100 focus-ring"
          >
            <Play size={14} fill="currentColor" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            if (isActive) playTrack(track);
            else playTracks(context, index);
          }}
          aria-label={`Play ${track.title}`}
          className="relative shrink-0"
        >
          {showArtwork ? (
            <Artwork
              src={artworkUrl}
              alt={track.title}
              className={cn("h-11 w-11", dense && "h-10 w-10")}
              rounded="rounded-[10px]"
              iconSize={16}
            />
          ) : (
            <div className="h-9 w-9 rounded-[9px] bg-surface2" />
          )}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/45 text-white transition-opacity",
              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {isActive && playing ? <Equalizer playing /> : <Play size={15} fill="currentColor" />}
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
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-[13.5px] font-medium", isActive && "text-accent")}>{track.title}</span>
          {track.featuredArtists.length > 0 && (
            <span className="hidden truncate text-[11.5px] text-muted sm:inline">
              feat. {track.featuredArtists.join(", ")}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
          {track.artistId ? (
            <Link
              href={`/artist/${encodeURIComponent(track.artistId)}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate hover:text-ink hover:underline"
            >
              {track.artist}
            </Link>
          ) : (
            <span className="truncate">{track.artist}</span>
          )}
          {showAlbum && track.album && <span className="hidden truncate sm:inline">· {track.album}</span>}
        </div>
      </button>

      {download?.status === "complete" && (
        <span title={download.authorised ? "Downloaded" : "Saved offline"} className="hidden text-muted sm:block">
          {download.authorised ? <Download size={13} /> : <Check size={13} />}
        </span>
      )}

      {showAlbum && track.playCount ? (
        <span className="hidden w-20 text-right text-[11.5px] tabular-nums text-muted md:block">
          {formatCount(track.playCount)} plays
        </span>
      ) : null}

      <span className="w-9 text-right text-[12px] tabular-nums text-muted">{formatTime(track.duration)}</span>

      <button
        aria-label={`More options for ${track.title}`}
        onClick={() => openSheet({ type: "trackMenu", track })}
        className="press focus-ring flex h-8 w-8 items-center justify-center rounded-full text-muted opacity-70 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink group-hover:opacity-100"
      >
        <MoreHorizontal size={16} />
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
