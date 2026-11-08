"use client";

import { useRef, useState } from "react";
import { ImagePlus, ListMusic, Plus, Trash2 } from "lucide-react";
import { Artwork } from "@/components/artwork";
import { Button, EmptyState } from "@/components/ui/primitives";
import { useAssetUrl } from "@/lib/use-asset-url";
import { KEYS, idbDel, idbSet } from "@/lib/storage";
import { useLibrary } from "@/store/library";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";
import type { Track } from "@/lib/types";

export function AddToPlaylistSheet({ track }: { track: Track }) {
  const playlists = useLibrary((s) => s.playlists);
  const addTracks = useLibrary((s) => s.addTracks);
  const closeSheet = useUi((s) => s.closeSheet);
  const openSheet = useUi((s) => s.openSheet);

  return (
    <div className="pb-3">
      <div className="flex items-center gap-3 px-3 pb-3">
        <Artwork src={track.artworkSmall || track.artwork} alt={track.title} className="h-12 w-12" rounded="rounded-[9px]" iconSize={16} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium">{track.title}</p>
          <p className="truncate text-[11.5px] text-muted">{track.artist}</p>
        </div>
      </div>
      <button
        onClick={() => openSheet({ type: "createPlaylist", track })}
        className="press mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-dashed border-line text-muted">
          <Plus size={16} />
        </span>
        <span className="text-[13px] font-medium">New playlist</span>
      </button>
      <div className="max-h-[46vh] space-y-0.5 overflow-y-auto">
        {playlists.map((playlist) => (
          <PlaylistRow
            key={playlist.id}
            playlistId={playlist.id}
            onPick={() => {
              const added = addTracks(playlist.id, [track]);
              closeSheet();
              toast(
                added ? `Added to “${playlist.name}”` : `Already in “${playlist.name}”`,
                added ? "success" : "neutral",
              );
            }}
          />
        ))}
      </div>
      {playlists.length === 0 && (
        <p className="px-4 py-6 text-center text-[12.5px] text-muted">
          You have no playlists yet. Create one — it stays on this device.
        </p>
      )}
    </div>
  );
}

function PlaylistRow({ playlistId, onPick }: { playlistId: string; onPick: () => void }) {
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === playlistId));
  const artUrl = useAssetUrl(playlist?.artworkKey);
  if (!playlist) return null;
  return (
    <button
      onClick={onPick}
      className="press flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
    >
      <Artwork src={artUrl || playlist.artworkUrl} alt={playlist.name} className="h-10 w-10" rounded="rounded-[9px]" iconSize={14} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{playlist.name}</span>
        <span className="block text-[11px] text-muted">{playlist.tracks.length} songs</span>
      </span>
      <Plus size={15} className="text-muted" />
    </button>
  );
}

export function CreatePlaylistSheet({ track }: { track?: Track }) {
  const [name, setName] = useState("");
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const addTracks = useLibrary((s) => s.addTracks);
  const closeSheet = useUi((s) => s.closeSheet);

  const submit = () => {
    const label = name.trim() || (track ? `${track.title}` : "New playlist");
    const id = createPlaylist(label, track ? [track] : []);
    if (track) addTracks(id, [track]);
    closeSheet();
    toast(`Created “${label}”`, "success");
  };

  return (
    <div className="px-3 pb-4">
      <label className="block px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Name</label>
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder={track ? track.title : "Late night drive"}
        className="mt-2 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[14px] outline-none transition-colors focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--line))]"
      />
      {track && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[12px] text-muted">
          <ListMusic size={14} />
          <span className="truncate">Starts with “{track.title}”</span>
        </div>
      )}
      <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted">
        Playlists are stored locally. No account, syncing or sharing required.
      </p>
      <Button variant="primary" className="mt-5 w-full" onClick={submit}>
        Create playlist
      </Button>
    </div>
  );
}

export function EditPlaylistSheet({ playlistId }: { playlistId: string }) {
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === playlistId));
  const rename = useLibrary((s) => s.renamePlaylist);
  const setArtwork = useLibrary((s) => s.setPlaylistArtwork);
  const removePlaylist = useLibrary((s) => s.deletePlaylist);
  const closeSheet = useUi((s) => s.closeSheet);
  const openSheet = useUi((s) => s.openSheet);
  const [name, setName] = useState(playlist?.name ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const artUrl = useAssetUrl(playlist?.artworkKey);

  if (!playlist) return null;

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("Choose an image file", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("That image is larger than 8 MB", "error");
      return;
    }
    const key = `playlist-art:${playlist.id}:${Date.now()}`;
    const ok = await idbSet(key, file);
    if (!ok) {
      toast("Couldn't save the artwork", "error");
      return;
    }
    if (playlist.artworkKey) await idbDel(playlist.artworkKey);
    setArtwork(playlist.id, key);
    toast("Playlist artwork updated", "success");
  };

  return (
    <div className="px-3 pb-4">
      <div className="flex items-center gap-3 px-1 pb-4">
        <Artwork src={artUrl || playlist.artworkUrl} alt={playlist.name} className="h-16 w-16" iconSize={20} />
        <div>
          <Button size="sm" variant="surface" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={14} /> Upload artwork
          </Button>
          {playlist.artworkKey && (
            <button
              onClick={() => {
                if (playlist.artworkKey) void idbDel(playlist.artworkKey);
                setArtwork(playlist.id, undefined);
              }}
              className="mt-2 block text-[11px] text-muted hover:text-ink"
            >
              Remove custom artwork
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </div>

      <label className="block px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Name</label>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            rename(playlist.id, name);
            closeSheet();
            toast("Playlist renamed", "success");
          }
        }}
        className="mt-2 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,var(--line))]"
      />

      <div className="mt-4 flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => {
            rename(playlist.id, name);
            closeSheet();
            toast("Playlist saved", "success");
          }}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            openSheet({
              type: "confirm",
              title: "Delete playlist?",
              message: `“${playlist.name}” will be removed from this device. The songs themselves stay in the catalogue.`,
              confirmLabel: "Delete playlist",
              destructive: true,
              onConfirm: () => {
                if (playlist.artworkKey) void idbDel(playlist.artworkKey);
                removePlaylist(playlist.id);
                closeSheet();
                toast("Playlist deleted", "success");
              },
            })
          }
        >
          <Trash2 size={15} /> Delete
        </Button>
      </div>
    </div>
  );
}

export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const closeSheet = useUi((s) => s.closeSheet);
  const [busy, setBusy] = useState(false);
  return (
    <div className="px-3 pb-2">
      <p className="px-1 pb-4 text-[13px] leading-relaxed text-muted">{message}</p>
      <div className="flex gap-2">
        <Button variant="surface" className="flex-1" onClick={closeSheet}>
          Cancel
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              closeSheet();
            }
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export function EmptyPlaylistState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={<ListMusic size={20} />}
      title="No playlists yet"
      description="Playlists live only on this device — no account needed."
      action={<Button variant="primary" onClick={onCreate}>Create playlist</Button>}
    />
  );
}
