"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Check, CloudOff, Music4, Play, RefreshCw, Shuffle, UserPlus } from "lucide-react";
import AppBar from "@/components/app-bar";
import { Artwork } from "@/components/artwork";
import { MediaCard } from "@/components/media-card";
import TrackList from "@/components/track-list";
import { Button, EmptyState, SectionTitle, Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/api-client";
import { formatCount } from "@/lib/format";
import { apiPath } from "@/lib/ids";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import type { Artist } from "@/lib/types";

export default function ArtistPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id ?? "";
  const { data, error, loading, reload } = useApi<{ artist: Artist }>(rawId ? apiPath("artist", rawId) : null, [rawId]);
  const artist = data?.artist;
  const followed = useLibrary((s) => (artist ? s.followedArtists.some((a) => a.id === artist.id) : false));
  const toggleFollow = useLibrary((s) => s.toggleFollow);
  const playTracks = usePlayer((s) => s.playTracks);
  const [bioOpen, setBioOpen] = useState(false);

  if (loading && !artist) return <ArtistSkeleton />;

  if (error || !artist) {
    return (
      <div className="page-pad py-16">
        <EmptyState
          icon={<CloudOff size={20} />}
          title="Artist unavailable"
          description={error || "This artist couldn't be found at the source."}
          action={
            <Button variant="surface" onClick={reload}>
              <RefreshCw size={14} /> Try again
            </Button>
          }
        />
      </div>
    );
  }

  const cover = artist.coverArtwork || artist.artwork;
  const popular = artist.topTracks.length ? artist.topTracks : artist.latestTracks;

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        {cover && (
          <div
            className="absolute inset-[-20%] scale-110 opacity-40 blur-3xl"
            style={{ backgroundImage: `url("/api/image?src=${encodeURIComponent(cover)}")`, backgroundSize: "cover" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--bg)_40%,transparent)] to-[var(--bg)]" />
      </div>

      <div className="relative z-10 page-pad pb-12">
        <AppBar backHref="/search" />
        <header className="anim-rise flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:gap-7">
          <Artwork
            src={artist.artwork}
            alt={artist.name}
            rounded="rounded-full"
            className="h-28 w-28 shrink-0 shadow-[var(--shadow-art)] ring-1 ring-white/10 sm:h-40 sm:w-40"
            iconSize={36}
            eager
          />
          <div className="min-w-0">
            <h1 className="font-display flex flex-wrap items-center gap-2 text-[clamp(28px,5.2vw,42px)] leading-[1.03]">
              {artist.name}
              {artist.verified && <BadgeCheck size={20} className="text-accent" aria-label="Verified" />}
            </h1>
            <p className="mt-2 text-[12.5px] text-muted">
              {artist.followerCount !== undefined ? `${formatCount(artist.followerCount)} followers` : ""}
              {artist.followerCount !== undefined && artist.trackCount ? " · " : ""}
              {artist.trackCount ? `${formatCount(artist.trackCount)} tracks` : ""}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  playTracks(popular, 0);
                }}
              >
                <Play size={15} fill="currentColor" /> Play
              </Button>
              <button
                onClick={() => playTracks([...popular].sort(() => Math.random() - 0.5), 0)}
                className="press focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink/85 hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]"
              >
                <Shuffle size={14} /> Shuffle
              </button>
              <button
                onClick={() => toggleFollow(artist)}
                className={
                  followed
                    ? "press focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink/85 hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]"
                    : "press focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] px-4 text-sm text-accent hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                }
              >
                {followed ? <Check size={14} /> : <UserPlus size={14} />}
                {followed ? "Following" : "Follow"}
              </button>
            </div>
          </div>
        </header>

        {artist.bio && (
          <div className="mt-7 max-w-2xl">
            <p className={`text-[13px] leading-relaxed text-muted ${bioOpen ? "" : "line-clamp-3"}`}>{artist.bio}</p>
            <button onClick={() => setBioOpen((v) => !v)} className="mt-1.5 text-[12px] text-ink/70 hover:text-ink">
              {bioOpen ? "Show less" : "Read more"}
            </button>
          </div>
        )}

        {popular.length > 0 && (
          <section className="mt-9 anim-rise">
            <SectionTitle title="Popular" subtitle="Ordered by the source's real play counts" />
            <div className="py-1">
              <TrackList tracks={popular} showCoverNumber showAlbum />
            </div>
          </section>
        )}

        {artist.latestTracks.length > 0 && (
          <section className="mt-9">
            <SectionTitle title="Latest" subtitle="Most recent releases" />
            <div className="py-1">
              <TrackList tracks={artist.latestTracks.slice(0, 8)} showAlbum />
            </div>
          </section>
        )}

        {artist.albums.length > 0 && (
          <section className="mt-9">
            <SectionTitle title="Albums" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {artist.albums.map((album) => (
                <MediaCard
                  key={album.id}
                  href={`/album/${encodeURIComponent(album.id)}`}
                  title={album.name}
                  subtitle={`${album.trackCount ?? "—"} tracks`}
                  artwork={album.artwork}
                />
              ))}
            </div>
          </section>
        )}

        {artist.playlists.length > 0 && (
          <section className="mt-9">
            <SectionTitle title="Playlists" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {artist.playlists.map((playlist) => (
                <Link key={playlist.id} href={`/album/${encodeURIComponent(playlist.id)}`} className="press group">
                  <Artwork src={playlist.artwork} alt={playlist.name} className="aspect-square w-full" iconSize={22} />
                  <p className="mt-2 truncate text-[13px] font-medium">{playlist.name}</p>
                  <p className="text-[11.5px] text-muted">{playlist.trackCount ? `${playlist.trackCount} tracks` : "Playlist"}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!popular.length && (
          <EmptyState
            className="mt-10"
            icon={<Music4 size={20} />}
            title="No playable tracks"
            description="This artist has no streamable tracks at the source right now."
          />
        )}
      </div>
    </div>
  );
}

function ArtistSkeleton() {
  return (
    <div className="page-pad pt-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Skeleton className="h-28 w-28 rounded-full sm:h-40 sm:w-40" />
        <div className="flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-9 w-64" />
          <Skeleton className="mt-3 h-3 w-40" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-[10px]" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="mt-1.5 h-2.5 w-1/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
