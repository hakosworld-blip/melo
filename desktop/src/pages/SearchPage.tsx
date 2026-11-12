"use client";

import { useRef, useState } from "react";
import { IconClose, IconSearch, IconSearchX } from "@/components/ui/icons";
import { ArtistCard, MediaCard } from "@/components/media-card";
import SectionBackground from "@/components/section-background";
import TrackList from "@/components/track-list";
import { EmptyState, SectionTitle, Segmented, Skeleton } from "@/components/ui/primitives";
import { useApi, useDebounced } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useSettings } from "@/store/settings";
import type { AlbumSummary, ArtistSummary, Track } from "@/lib/types";

interface SearchResponse {
  tracks: Track[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
  error?: string;
}

const SUGGESTIONS = ["Lo-fi", "Ambient", "Jazz", "Hip-Hop", "House", "Electronic", "Chill", "R&B"];

export default function SearchPage() {
  // One source only.
  const provider = "youtube" as const;
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 350);
  const [tab, setTab] = useState<"all" | "songs" | "artists" | "albums">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const path = debounced.trim() ? `/api/search?q=${encodeURIComponent(debounced.trim())}&provider=${provider}&limit=30` : null;
  const { data, error, loading } = useApi<SearchResponse>(path);

  const tracks = data?.tracks ?? [];
  const artists = data?.artists ?? [];
  const albums = data?.albums ?? [];
  const empty = !loading && !error && data && !tracks.length && !artists.length && !albums.length;

  return (
    <div className="relative min-h-full">
      <SectionBackground section="app" />
      <div className="relative z-10">
        <div className="chrome sticky top-0 z-30 border-b border-line px-4 pb-3 pt-[max(env(safe-area-inset-top),14px)] sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="relative">
              <IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Songs, artists, albums…"
                aria-label="Search music"
                autoComplete="off"
                className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-10 text-[14px] outline-none transition-colors placeholder:text-muted focus:border-[color-mix(in_srgb,var(--accent)_50%,var(--line))]"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="press absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink"
                >
                  <IconClose size={14} />
                </button>
              )}
            </div>
            {query && (
              <div className="mt-3">
                <Segmented
                  value={tab}
                  onChange={setTab}
                  size="sm"
                  options={[
                    { value: "all", label: "All" },
                    { value: "songs", label: `Songs${tracks.length ? ` · ${tracks.length}` : ""}` },
                    { value: "artists", label: "Artists" },
                    { value: "albums", label: "Albums" },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl page-pad pb-12 pt-6">
          {!query && (
            <div className="anim-rise">
              <h1 className="page-head">Search</h1>
              <p className="mt-2 text-[12.5px] text-muted">
                Songs from YouTube Music
              </p>
              <p className="mb-3 mt-7 text-[12.5px] font-semibold text-muted">Try a sound</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setQuery(suggestion)}
                    className="press rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-ink/85 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-3">
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
          )}

          {error && (
            <EmptyState
              icon={<IconSearchX size={20} />}
              title="Search failed"
              description={error}
            />
          )}

          {empty && (
            <EmptyState
              icon={<IconSearchX size={20} />}
              title="No matches"
              description={`Nothing in the catalogue matched “${debounced.trim()}”. Try a different spelling or another source.`}
            />
          )}

          {!loading && !error && data && (tracks.length > 0 || artists.length > 0 || albums.length > 0) && (
            <div className="space-y-8">
              {(tab === "all" || tab === "songs") && tracks.length > 0 && (
                <section className="anim-fade">
                  <SectionTitle title="Songs" />
                  <div className="py-1">
                    <TrackList tracks={tab === "all" ? tracks.slice(0, 8) : tracks} showAlbum />
                  </div>
                  {tab === "all" && tracks.length > 8 && (
                    <button onClick={() => setTab("songs")} className="mt-2 px-2 text-[12.5px] text-muted hover:text-ink">
                      Show all {tracks.length} songs
                    </button>
                  )}
                </section>
              )}

              {(tab === "all" || tab === "artists") && artists.length > 0 && (
                <section className="anim-fade">
                  <SectionTitle title="Artists" />
                  <div className={cn("grid gap-2", "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
                    {artists.map((artist) => (
                      <ArtistCard
                        key={artist.id}
                        href={`/artist/${encodeURIComponent(artist.id)}`}
                        name={artist.name}
                        artwork={artist.artwork}
                        followers={artist.followerCount}
                      />
                    ))}
                  </div>
                </section>
              )}

              {(tab === "all" || tab === "albums") && albums.length > 0 && (
                <section className="anim-fade">
                  <SectionTitle title="Albums" />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {albums.map((album) => (
                      <MediaCard
                        key={album.id}
                        href={`/album/${encodeURIComponent(album.id)}`}
                        title={album.name}
                        subtitle={album.artist}
                        artwork={album.artwork}
                      />
                    ))}
                  </div>
                </section>
              )}

              {tab === "artists" && !artists.length && <NoTabMatches label="artists" query={debounced.trim()} />}
              {tab === "albums" && !albums.length && <NoTabMatches label="albums" query={debounced.trim()} />}
              {tab === "songs" && !tracks.length && <NoTabMatches label="songs" query={debounced.trim()} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoTabMatches({ label, query }: { label: string; query: string }) {
  return (
    <EmptyState
      compact
      icon={<IconSearchX size={20} />}
      title={`No ${label} found`}
      description={`Nothing matched “${query}” in ${label}.`}
    />
  );
}
