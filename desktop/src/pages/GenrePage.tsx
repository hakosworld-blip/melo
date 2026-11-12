"use client";

import Link from "@/lib/router";
import { useParams } from "@/lib/router";
import { useState } from "react";
import AppBar from "@/components/app-bar";
import TrackList from "@/components/track-list";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { IconCloudOff, IconPlay, IconRefresh, IconShuffle } from "@/components/ui/icons";
import { useApi } from "@/lib/api-client";
import { formatDurationLong } from "@/lib/format";
import { usePlayer } from "@/store/player";
import { useSettings } from "@/store/settings";
import type { Track } from "@/lib/types";

interface GenreResponse {
  genre: string;
  tracks: Track[];
  error?: string;
}

export default function GenrePage() {
  const params = useParams<{ genre: string }>();
  const raw = params?.genre ?? "";
  const genre = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  // One source only.
  const provider = "youtube" as const;
  const { data, error, loading, reload } = useApi<GenreResponse>(
    genre ? `/api/genre?provider=${provider}&genre=${encodeURIComponent(genre)}&limit=50` : null,
    [genre, provider],
  );
  const playTracks = usePlayer((s) => s.playTracks);
  const [shuffled, setShuffled] = useState(false);

  const tracks = data?.tracks ?? [];
  const duration = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[340px] overflow-hidden">
        {tracks[0]?.artwork && (
          <div
            className="absolute inset-[-30%] scale-125 opacity-80 blur-2xl saturate-150"
            style={{
              backgroundImage: `url("/api/image?src=${encodeURIComponent(tracks[0].artwork)}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--bg)_45%,transparent)] to-[var(--bg)]" />
      </div>

      <div className="relative z-10 page-pad pb-12">
        <AppBar backHref="/" />

        <header className="anim-rise pt-1">
          <h1 className="page-head">{genre}</h1>
          {tracks.length > 0 && (
            <p className="mt-2 text-[12.5px] text-muted">
              Genre · {tracks.length} songs · {formatDurationLong(duration)} · popular this week
            </p>
          )}
          <div className="mt-5 flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                if (!tracks.length) return;
                setShuffled(false);
                playTracks(tracks, 0);
              }}
              disabled={!tracks.length}
            >
              <IconPlay size={14} /> Play
            </Button>
            <button
              onClick={() => {
                if (!tracks.length) return;
                const mixed = [...tracks];
                for (let i = mixed.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
                }
                setShuffled(true);
                playTracks(mixed, 0);
              }}
              disabled={!tracks.length}
              className="press focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-[13.5px] text-ink/85 hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] disabled:opacity-45"
            >
              <IconShuffle size={15} /> Shuffle
            </button>
            {shuffled && <span className="text-[11.5px] text-muted">Shuffled order is in the queue</span>}
          </div>
        </header>

        <section className="mt-7">
          {loading && !tracks.length && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-[6px]" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="mt-1.5 h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && (error || !tracks.length) && (
            <EmptyState
              icon={<IconCloudOff size={20} />}
              title={error ? "Couldn't load this genre" : "Nothing in this genre right now"}
              description={
                error ||
                "The source returned no streamable tracks. Genres change with what artists publish, so it's worth checking back."
              }
              action={
                error ? (
                  <Button variant="surface" onClick={reload}>
                    <IconRefresh size={14} /> Try again
                  </Button>
                ) : (
                  <Link href="/">
                    <Button variant="surface">Back to Home</Button>
                  </Link>
                )
              }
            />
          )}

          {tracks.length > 0 && <TrackList tracks={tracks} showCoverNumber showAlbum />}
        </section>
      </div>
    </div>
  );
}
