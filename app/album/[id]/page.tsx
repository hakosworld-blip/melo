"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CloudOff, Disc3, Play, RefreshCw, Shuffle } from "lucide-react";
import AppBar from "@/components/app-bar";
import { Artwork } from "@/components/artwork";
import TrackList from "@/components/track-list";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/api-client";
import { formatDurationLong, formatYear } from "@/lib/format";
import { apiPath } from "@/lib/ids";
import { usePlayer } from "@/store/player";
import type { Album } from "@/lib/types";

export default function AlbumPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id ?? "";
  const { data, error, loading, reload } = useApi<{ album: Album }>(rawId ? apiPath("album", rawId) : null, [rawId]);
  const album = data?.album;
  const playTracks = usePlayer((s) => s.playTracks);

  if (loading && !album) return <AlbumSkeleton />;

  if (error || !album) {
    return (
      <div className="page-pad py-16">
        <EmptyState
          icon={<CloudOff size={20} />}
          title="Album unavailable"
          description={error || "This release couldn't be found at the source."}
          action={
            <Button variant="surface" onClick={reload}>
              <RefreshCw size={14} /> Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        {album.artwork && (
          <div
            className="absolute inset-[-20%] scale-110 opacity-40 blur-3xl"
            style={{ backgroundImage: `url("/api/image?src=${encodeURIComponent(album.artwork)}")`, backgroundSize: "cover" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--bg)_40%,transparent)] to-[var(--bg)]" />
      </div>

      <div className="relative z-10 page-pad pb-12">
        <AppBar backHref="/search" />
        <header className="anim-rise flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:gap-7">
          <Artwork
            src={album.artwork}
            alt={album.name}
            className="h-40 w-40 shrink-0 shadow-[var(--shadow-art)] ring-1 ring-white/10 sm:h-52 sm:w-52"
            iconSize={40}
            eager
          />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(26px,5vw,38px)] leading-[1.05]">{album.name}</h1>
            <p className="mt-2 text-[13px]">
              {album.artistId ? (
                <Link href={`/artist/${encodeURIComponent(album.artistId)}`} className="hover:underline">
                  {album.artist}
                </Link>
              ) : (
                album.artist
              )}
              <span className="text-muted">
                {formatYear(album.releaseDate) ? ` · ${formatYear(album.releaseDate)}` : ""} · {album.tracks.length} tracks ·{" "}
                {formatDurationLong(album.duration)}
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => playTracks(album.tracks, 0)}>
                <Play size={15} fill="currentColor" /> Play
              </Button>
              <button
                onClick={() => playTracks([...album.tracks].sort(() => Math.random() - 0.5), 0)}
                className="press focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink/85 hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]"
              >
                <Shuffle size={14} /> Shuffle
              </button>
            </div>
          </div>
        </header>

        {album.description && (
          <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-muted">{album.description}</p>
        )}

        <section className="mt-8">
          {album.tracks.length ? (
            <div className="py-1">
              <TrackList tracks={album.tracks} showCoverNumber showAlbum />
            </div>
          ) : (
            <EmptyState icon={<Disc3 size={20} />} title="No tracks available" description="This release has no playable tracks at the source." />
          )}
        </section>
      </div>
    </div>
  );
}

function AlbumSkeleton() {
  return (
    <div className="page-pad pt-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Skeleton className="h-40 w-40 rounded-[var(--radius)] sm:h-52 sm:w-52" />
        <div className="flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-9 w-64" />
          <Skeleton className="mt-3 h-3 w-48" />
          <Skeleton className="mt-5 h-10 w-28 rounded-full" />
        </div>
      </div>
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
