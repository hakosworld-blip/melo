"use client";

import { useParams } from "@/lib/router";
import { Download, ListMusic, ListPlus, Pencil, Play, Shuffle } from "lucide-react";
import AppBar from "@/components/app-bar";
import { Artwork } from "@/components/artwork";
import TrackList from "@/components/track-list";
import { Button, EmptyState } from "@/components/ui/primitives";
import { formatDurationLong } from "@/lib/format";
import { useAssetUrl } from "@/lib/use-asset-url";
import { useDownloads } from "@/store/downloads";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";

export default function PlaylistPage() {
  const params = useParams<{ id: string }>();
  const playlistId = params?.id ?? "";
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === playlistId));
  const removeTrack = useLibrary((s) => s.removeTrack);
  const playTracks = usePlayer((s) => s.playTracks);
  const addManyToQueue = usePlayer((s) => s.addManyToQueue);
  const enqueue = useDownloads((s) => s.enqueue);
  const openSheet = useUi((s) => s.openSheet);
  const artUrl = useAssetUrl(playlist?.artworkKey);

  if (!playlist) {
    return (
      <div className="page-pad py-16">
        <EmptyState
          icon={<ListMusic size={20} />}
          title="Playlist not found"
          description="It may have been deleted on this device."
          action={<Button variant="surface" onClick={() => (window.location.href = "/library")}>Back to library</Button>}
        />
      </div>
    );
  }

  const duration = playlist.tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        {(artUrl || playlist.artworkUrl) && (
          <div
            className="absolute inset-[-20%] scale-110 opacity-40 blur-3xl"
            style={{
              backgroundImage: `url("${artUrl || `/api/image?src=${encodeURIComponent(playlist.artworkUrl || "")}`}")`,
              backgroundSize: "cover",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--bg)_40%,transparent)] to-[var(--bg)]" />
      </div>

      <div className="relative z-10 page-pad pb-12">
        <AppBar backHref="/library" />
        <header className="anim-rise flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:gap-7">
          <Artwork
            src={artUrl || playlist.artworkUrl}
            alt={playlist.name}
            className="h-40 w-40 shrink-0 shadow-[var(--shadow-art)] ring-1 ring-white/10 sm:h-52 sm:w-52"
            iconSize={40}
            eager
          />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-[1.05]">{playlist.name}</h1>
            <p className="mt-2 text-[13px] text-muted">
              {playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"} · {formatDurationLong(duration)}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => playTracks(playlist.tracks, 0)} disabled={!playlist.tracks.length}>
                <Play size={15} fill="currentColor" /> Play
              </Button>
              <button
                onClick={() => playTracks([...playlist.tracks].sort(() => Math.random() - 0.5), 0)}
                disabled={!playlist.tracks.length}
                className="press focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink/85 hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] disabled:opacity-45"
              >
                <Shuffle size={14} /> Shuffle
              </button>
              <button
                onClick={() => openSheet({ type: "editPlaylist", playlistId: playlist.id })}
                aria-label="Edit playlist"
                className="press focus-ring inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted hover:text-ink"
              >
                <Pencil size={14} /> Edit
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            variant="surface"
            size="sm"
            disabled={!playlist.tracks.length}
            onClick={() => {
              addManyToQueue(playlist.tracks);
              toast(`Added ${playlist.tracks.length} songs to the queue`, "success");
            }}
          >
            <ListPlus size={14} /> Add to queue
          </Button>
          <Button
            variant="surface"
            size="sm"
            disabled={!playlist.tracks.length}
            onClick={() => {
              playlist.tracks.forEach((track) => enqueue(track));
              toast(`Saving ${playlist.tracks.length} songs offline`, "neutral");
            }}
          >
            <Download size={14} /> Download all
          </Button>
        </div>

        <section className="mt-8">
          {playlist.tracks.length ? (
            <div className="py-1">
              <TrackList
                tracks={playlist.tracks}
                showAlbum
                onRemove={(track) => {
                  removeTrack(playlist.id, track.id);
                  toast(`Removed “${track.title}”`, "neutral");
                }}
              />
            </div>
          ) : (
            <EmptyState
              icon={<ListMusic size={20} />}
              title="This playlist is empty"
              description="Open any song's menu and choose “Add to playlist”."
              action={<Button variant="surface" onClick={() => (window.location.href = "/search")}>Find music</Button>}
            />
          )}
        </section>
      </div>
    </div>
  );
}
