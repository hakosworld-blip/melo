"use client";

import TrackRow from "@/components/track-row";
import type { Track } from "@/lib/types";

export default function TrackList({
  tracks,
  showAlbum,
  showCoverNumber,
  dense,
  onRemove,
}: {
  tracks: Track[];
  showAlbum?: boolean;
  showCoverNumber?: boolean;
  dense?: boolean;
  onRemove?: (track: Track) => void;
}) {
  return (
    <div className="space-y-0.5">
      {tracks.map((track, index) => (
        <TrackRow
          key={`${track.id}-${index}`}
          track={track}
          index={index}
          context={tracks}
          showAlbum={showAlbum}
          showCoverNumber={showCoverNumber}
          dense={dense}
          onRemove={onRemove ? () => onRemove(track) : undefined}
        />
      ))}
    </div>
  );
}
