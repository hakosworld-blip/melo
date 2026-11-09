"use client";

import { ImportPlaylistSheet } from "@/components/import-playlist-sheet";
import LyricsView from "@/components/lyrics-view";
import QueueView from "@/components/queue-view";
import TrackMenu from "@/components/track-menu";
import {
  AddToPlaylistSheet,
  ConfirmSheet,
  CreatePlaylistSheet,
  EditPlaylistSheet,
} from "@/components/playlist-sheets";
import { Sheet } from "@/components/ui/primitives";
import { useUi } from "@/store/ui";

export default function GlobalSheets() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);

  return (
    <>
      <Sheet
        open={sheet?.type === "queue"}
        onClose={close}
        title="Queue"
        description="Drag to reorder · tap a song to jump"
        wide
      >
        {sheet?.type === "queue" && <QueueView />}
      </Sheet>

      <Sheet open={sheet?.type === "lyrics"} onClose={close} wide>
        {sheet?.type === "lyrics" && <LyricsView track={sheet.track ?? (undefined as never)} onClose={close} />}
      </Sheet>

      <Sheet open={sheet?.type === "trackMenu"} onClose={close} title="Options">
        {sheet?.type === "trackMenu" && <TrackMenu track={sheet.track} />}
      </Sheet>

      <Sheet open={sheet?.type === "addToPlaylist"} onClose={close} title="Add to playlist">
        {sheet?.type === "addToPlaylist" && <AddToPlaylistSheet track={sheet.track} />}
      </Sheet>

      <Sheet open={sheet?.type === "createPlaylist"} onClose={close} title="New playlist">
        {sheet?.type === "createPlaylist" && <CreatePlaylistSheet track={sheet.track} />}
      </Sheet>

      <Sheet
        open={sheet?.type === "importPlaylist"}
        onClose={close}
        title="Import a playlist"
        description="Paste a Spotify or YouTube Music link — melo keeps the name and songs"
      >
        {sheet?.type === "importPlaylist" && <ImportPlaylistSheet />}
      </Sheet>

      <Sheet open={sheet?.type === "editPlaylist"} onClose={close} title="Edit playlist">
        {sheet?.type === "editPlaylist" && <EditPlaylistSheet playlistId={sheet.playlistId} />}
      </Sheet>

      <Sheet open={sheet?.type === "confirm"} onClose={close} title={sheet?.type === "confirm" ? sheet.title : undefined}>
        {sheet?.type === "confirm" && (
          <ConfirmSheet
            title={sheet.title}
            message={sheet.message}
            confirmLabel={sheet.confirmLabel}
            destructive={sheet.destructive}
            onConfirm={sheet.onConfirm}
          />
        )}
      </Sheet>
    </>
  );
}
