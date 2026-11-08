"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CloudOff, Play, RefreshCw, Search, Shuffle } from "lucide-react";
import AppBar from "@/components/app-bar";
import { Artwork } from "@/components/artwork";
import { ArtistCard, MediaCard } from "@/components/media-card";
import SectionBackground from "@/components/section-background";
import TrackCard from "@/components/track-card";
import TrackList from "@/components/track-list";
import { Button, EmptyState, SectionTitle, Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/api-client";
import { PROVIDER_LABEL, PROVIDER_NOTE } from "@/lib/constants";
import { formatCount } from "@/lib/format";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { useSettings } from "@/store/settings";
import type { AlbumSummary, ArtistSummary, HomeSection, Track } from "@/lib/types";

interface HomeResponse {
  provider: string;
  sections: HomeSection[];
  error?: string;
}

export default function HomePage() {
  const provider = useSettings((s) => s.provider);
  const { data, error, loading, reload } = useApi<HomeResponse>(`/api/home?provider=${provider}`);
  const recent = useLibrary((s) => s.recent);
  const playStats = useLibrary((s) => s.playStats);
  const playTracks = usePlayer((s) => s.playTracks);
  const [heroIndex, setHeroIndex] = useState(0);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  const top = useMemo(
    () =>
      Object.entries(playStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([id]) => recent.find((track) => track.id === id))
        .filter((track): track is NonNullable<typeof track> => Boolean(track)),
    [playStats, recent],
  );

  const sections = data?.sections ?? [];
  const trending = (sections.find((s) => s.kind === "tracks")?.items as Track[] | undefined) ?? [];
  const hero = trending[heroIndex % Math.max(trending.length, 1)] ?? trending[0];

  return (
    <div className="relative min-h-full">
      <SectionBackground section="home" />
      <div className="relative z-10">
        <AppBar
          title="Home"
          subtitle={greeting || undefined}
          actions={
            <Link
              href="/search"
              aria-label="Search"
              className="press focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink/70 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink"
            >
              <Search size={18} />
            </Link>
          }
        />

        <div className="page-pad pb-12 pt-2">
          {loading && !data && <HomeSkeleton />}

          {error && !data && (
            <EmptyState
              icon={<CloudOff size={20} />}
              title="Couldn't reach the music source"
              description={error}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="surface" onClick={reload}>
                    <RefreshCw size={14} /> Try again
                  </Button>
                  <Link href="/settings#source">
                    <Button variant="ghost">Choose a source</Button>
                  </Link>
                </div>
              }
            />
          )}

          {hero && (
            <section className="anim-rise mt-2">
              <div className="surface flex items-center gap-4 p-3 sm:gap-5 sm:p-4">
                <div key={hero.id} className="anim-scale shrink-0">
                  <Artwork
                    src={hero.artwork}
                    alt={hero.title}
                    eager
                    iconSize={26}
                    rounded="rounded-[calc(var(--radius)-4px)]"
                    className="h-[104px] w-[104px] shadow-[0_16px_34px_-26px_rgba(0,0,0,0.95)] sm:h-[128px] sm:w-[128px]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-[16.5px] font-semibold leading-snug tracking-[-0.01em] sm:text-[19px]">
                    {hero.title}
                  </h2>
                  <p className="mt-1 truncate text-[12.5px] text-muted">
                    {hero.artist}
                    {hero.playCount ? ` · ${formatCount(hero.playCount)} plays` : ""}
                  </p>
                  <div className="mt-3.5 flex items-center gap-2">
                    <button
                      onClick={() => {
                        const index = trending.findIndex((t) => t.id === hero.id);
                        playTracks(trending, Math.max(0, index));
                      }}
                      className="press focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-accentink transition-[filter] hover:brightness-[1.05]"
                    >
                      <Play size={14} fill="currentColor" /> Play
                    </button>
                    <button
                      onClick={() => playTracks([...trending].sort(() => Math.random() - 0.5), 0)}
                      className="press focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[12.5px] text-ink/80 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink"
                    >
                      <Shuffle size={14} /> Shuffle
                    </button>
                    {trending.length > 1 && (
                      <button
                        onClick={() => setHeroIndex((i) => (i + 1) % trending.length)}
                        aria-label="Next pick"
                        className="press focus-ring ml-auto flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-ink"
                      >
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {recent.length > 0 && (
            <Rail title="Recently played">
              {recent.slice(0, 10).map((track, index) => (
                <TrackCard key={track.id} track={track} context={recent} index={index} />
              ))}
            </Rail>
          )}

          {top.length >= 2 && (
            <section className="mt-8">
              <SectionTitle title="Your most played" subtitle="Counted locally on this device" />
              <div className="surface px-1.5 py-1.5 sm:px-2">
                <TrackList tracks={top} />
              </div>
            </section>
          )}

          {sections.map((section, sectionIndex) => (
            <Rail key={section.id} title={section.title} subtitle={section.subtitle} delay={sectionIndex}>
              {section.kind === "tracks" &&
                (section.items as Track[]).map((track, index) => (
                  <TrackCard
                    key={`${section.id}-${track.id}`}
                    track={track}
                    context={section.items as Track[]}
                    index={index}
                  />
                ))}
              {section.kind === "artists" &&
                (section.items as ArtistSummary[]).map((artist) => (
                  <ArtistCard
                    key={`${section.id}-${artist.id}`}
                    href={`/artist/${encodeURIComponent(artist.id)}`}
                    name={artist.name}
                    artwork={artist.artwork}
                    followers={artist.followerCount}
                  />
                ))}
              {section.kind === "albums" &&
                (section.items as AlbumSummary[]).map((album) => (
                  <MediaCard
                    key={`${section.id}-${album.id}`}
                    href={`/album/${encodeURIComponent(album.id)}`}
                    title={album.name}
                    subtitle={album.artist}
                    artwork={album.artwork}
                  />
                ))}
            </Rail>
          ))}

          {!loading && !error && !sections.length && (
            <EmptyState
              icon={<CloudOff size={20} />}
              title="Nothing came back"
              description={`${PROVIDER_LABEL[provider]} returned no music just now. ${PROVIDER_NOTE[provider]}.`}
              action={
                <Button variant="surface" onClick={reload}>
                  Refresh
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Rail({
  title,
  subtitle,
  children,
  delay = 0,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const items = Array.isArray(children) ? children : [children];
  if (!items.flat().filter(Boolean).length) return null;
  return (
    <section className="anim-rise mt-8" style={{ animationDelay: `${Math.min(delay, 4) * 45}ms` }}>
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="rail no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">{items}</div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-8 pt-2">
      <div className="surface flex items-center gap-4 p-3 sm:p-4">
        <Skeleton className="h-[104px] w-[104px] shrink-0 rounded-[calc(var(--radius)-4px)] sm:h-[128px] sm:w-[128px]" />
        <div className="flex-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-4 h-9 w-32 rounded-full" />
        </div>
      </div>
      {[0, 1].map((row) => (
        <div key={row}>
          <Skeleton className="mb-4 h-5 w-44" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-[138px] shrink-0">
                <Skeleton className="aspect-square w-full rounded-[var(--radius)]" />
                <Skeleton className="mt-2 h-3 w-3/4" />
                <Skeleton className="mt-1.5 h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
