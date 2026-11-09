"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, HardDrive, Link2, ListMusic, Music4, Plus, Users } from "lucide-react";
import AppBar from "@/components/app-bar";
import { Artwork } from "@/components/artwork";
import DownloadList, { totalDownloadBytes } from "@/components/download-list";
import SectionBackground from "@/components/section-background";
import TrackList from "@/components/track-list";
import { Button, EmptyState, SectionTitle, Segmented } from "@/components/ui/primitives";
import { formatBytes, formatDurationLong } from "@/lib/format";
import { useAssetUrl } from "@/lib/use-asset-url";
import { useDownloads } from "@/store/downloads";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";
import { cn } from "@/lib/cn";

type Tab = "playlists" | "artists" | "songs" | "downloads";

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("playlists");
  const playlists = useLibrary((s) => s.playlists);
  const followed = useLibrary((s) => s.followedArtists);
  const recent = useLibrary((s) => s.recent);
  const playStats = useLibrary((s) => s.playStats);
  const openSheet = useUi((s) => s.openSheet);
  const records = useDownloads((s) => s.records);
  const order = useDownloads((s) => s.order);

  const downloads = useMemo(() => order.map((id) => records[id]).filter(Boolean), [order, records]);
  const downloadedBytes = downloads.reduce((sum, record) => sum + totalDownloadBytes(record), 0);
  const downloadedDuration = downloads.reduce((sum, record) => sum + (record.track.duration || 0), 0);

  const mostPlayed = useMemo(() => {
    const counts = Object.entries(playStats).sort((a, b) => b[1].count - a[1].count);
    return counts
      .map(([id]) => recent.find((track) => track.id === id))
      .filter((track): track is NonNullable<typeof track> => Boolean(track))
      .slice(0, 20);
  }, [playStats, recent]);

  return (
    <div className="relative min-h-full">
      <SectionBackground section="library" />
      <div className="relative z-10 page-pad pb-12">
        <AppBar
          title="Library"
          subtitle={[
            `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlists"}`,
            `${followed.length} ${followed.length === 1 ? "artist" : "artists"}`,
            `${downloads.length} ${downloads.length === 1 ? "download" : "downloads"}`,
          ].join(" · ")}
          actions={
            <Link
              href="/settings#storage"
              className="press focus-ring flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] tabular-nums text-muted hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-ink"
            >
              <HardDrive size={14} /> {formatBytes(downloadedBytes)}
            </Link>
          }
        />

        <div className="mt-4 max-w-xl">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "playlists", label: "Playlists", icon: <ListMusic size={13} /> },
              { value: "artists", label: "Artists", icon: <Users size={13} /> },
              { value: "songs", label: "Songs", icon: <Music4 size={13} /> },
              { value: "downloads", label: "Downloads", icon: <Download size={13} /> },
            ]}
          />
        </div>

        <div className="mt-7">
          {tab === "playlists" && (
            <section className="anim-fade">
              <SectionTitle
                title="Playlists"
                subtitle="Private to this device"
                action={
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="surface" onClick={() => openSheet({ type: "importPlaylist" })}>
                      <Link2 size={14} /> Import
                    </Button>
                    <Button size="sm" variant="surface" onClick={() => openSheet({ type: "createPlaylist" })}>
                      <Plus size={14} /> New
                    </Button>
                  </div>
                }
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <button
                  onClick={() => openSheet({ type: "createPlaylist" })}
                  className="press flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-line text-muted transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:text-ink"
                >
                  <Plus size={22} />
                  <span className="text-[12.5px]">New playlist</span>
                </button>
                {playlists.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlistId={playlist.id} />
                ))}
              </div>
              {!playlists.length && (
                <p className="mt-4 max-w-md text-[12.5px] leading-relaxed text-muted">
                  Playlists stay on this device. Start one from any song&apos;s menu, or import a Spotify or
                  YouTube Music link to bring a list you already have.
                </p>
              )}
            </section>
          )}

          {tab === "artists" && (
            <section className="anim-fade">
              <SectionTitle title="Following" subtitle="Artists you keep an eye on" />
              {followed.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {followed.map((artist) => (
                    <Link
                      key={artist.id}
                      href={`/artist/${encodeURIComponent(artist.id)}`}
                      className="press group flex flex-col items-center gap-2 rounded-[var(--radius)] p-2 hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
                    >
                      <Artwork
                        src={artist.artwork}
                        alt={artist.name}
                        rounded="rounded-full"
                        className="aspect-square w-full max-w-[130px] transition-transform duration-500 group-hover:scale-[1.03]"
                        iconSize={24}
                      />
                      <p className="w-full truncate text-center text-[12.5px] font-medium">{artist.name}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<Users size={20} />}
                  title="Not following anyone yet"
                  description="Open an artist and tap Follow — they'll show up here."
                  action={
                    <Link href="/search">
                      <Button variant="surface" size="sm">Find artists</Button>
                    </Link>
                  }
                />
              )}
            </section>
          )}

          {tab === "songs" && (
            <section className="anim-fade space-y-8">
              {recent.length > 0 && (
                <div>
                  <SectionTitle title="Recently played" subtitle={`${recent.length} tracks in your history`} />
                  <div className="py-1">
                    <TrackList tracks={recent.slice(0, 20)} showAlbum />
                  </div>
                </div>
              )}
              {mostPlayed.length > 1 && (
                <div>
                  <SectionTitle title="Most played" subtitle="Local play counts only" />
                  <div className="py-1">
                    <TrackList tracks={mostPlayed} showCoverNumber />
                  </div>
                </div>
              )}
              {!recent.length && (
                <EmptyState
                  icon={<Music4 size={20} />}
                  title="No listening history yet"
                  description="Play something and your history builds here — privately, on this device."
                  action={
                    <Link href="/">
                      <Button variant="surface" size="sm">Browse music</Button>
                    </Link>
                  }
                />
              )}
            </section>
          )}

          {tab === "downloads" && (
            <section className="anim-fade">
              <SectionTitle
                title="Downloads"
                subtitle={
                  downloads.length
                    ? `${formatBytes(downloadedBytes)} · ${formatDurationLong(downloadedDuration)} of audio`
                    : "Audio, artwork, metadata and lyrics saved offline"
                }
                action={
                  <Link href="/settings#storage">
                    <Button size="sm" variant="ghost">
                      <HardDrive size={14} /> Storage
                    </Button>
                  </Link>
                }
              />
              <div className={cn("py-1")}>
                <DownloadList />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({ playlistId }: { playlistId: string }) {
  const playlist = useLibrary((s) => s.playlists.find((p) => p.id === playlistId));
  const artUrl = useAssetUrl(playlist?.artworkKey);
  if (!playlist) return null;
  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className="press group min-w-0 rounded-[var(--radius)] p-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
    >
      <Artwork
        src={artUrl || playlist.artworkUrl}
        alt={playlist.name}
        className="aspect-square w-full shadow-[0_14px_34px_-24px_rgba(0,0,0,0.9)]"
        iconSize={22}
      />
      <p className="mt-2 truncate text-[13px] font-medium">{playlist.name}</p>
      <p className="text-[11.5px] text-muted">
        {playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"}
      </p>
    </Link>
  );
}
