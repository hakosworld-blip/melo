"use client";

import Link from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { Artwork } from "@/components/artwork";
import { ArtistCard, MediaCard } from "@/components/media-card";
import SectionBackground from "@/components/section-background";
import TrackCard from "@/components/track-card";
import TrackRow from "@/components/track-row";
import { Button, EmptyState, SectionTitle, Skeleton } from "@/components/ui/primitives";
import { IconArrowRight, IconCloudOff, IconPlay, IconRefresh, IconSettings, IconShuffle } from "@/components/ui/icons";
import { useApi } from "@/lib/api-client";
import { PROVIDER_LABEL, PROVIDER_NOTE } from "@/lib/constants";
import { dayKey } from "@/lib/feed";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { useSettings } from "@/store/settings";
import { cn } from "@/lib/cn";
import type { AlbumSummary, ArtistSummary, GenreSummary, HomeSection, Track } from "@/lib/types";

interface HomeResponse {
  provider: string;
  sections: HomeSection[];
  genres: GenreSummary[];
  day: string;
  personalised: boolean;
  error?: string;
}

/** The mix list is long on purpose; a dozen rows is what a phone shows well. */
const MIX_PREVIEW = 12;

type ChartArtist = {
  name: string;
  rank: number;
  monthlyListeners: number;
  dailyChange: number;
  worldwide: { position: number; title: string } | null;
};

function compact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export default function HomePage() {
  // One source only.
  const provider = "youtube" as const;
  const recent = useLibrary((s) => s.recent);
  const pinned = useLibrary((s) => s.pinned);
  const playTracks = usePlayer((s) => s.playTracks);
  // Rankings come from kworb.net independently of the music source.
  const { data: charts } = useApi<{ updated: string | null; artists: ChartArtist[] }>("/api/charts/top?limit=10", []);

  /**
   * The taste snapshot is taken once per day. Without this, playing a song from
   * Home would change the play counts, change the query, and rebuild the shelf
   * under the listener's finger.
   */
  const [seedQuery, setSeedQuery] = useState<string | null>(null);
  const [mixOpen, setMixOpen] = useState(false);
  const [clock, setClock] = useState<{ greeting: string; date: string } | null>(null);

  useEffect(() => {
    setClock({
      greeting:
        new Date().getHours() < 5
          ? "Late night"
          : new Date().getHours() < 12
            ? "Good morning"
            : new Date().getHours() < 18
              ? "Good afternoon"
              : "Good evening",
      date: new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
    });
  }, []);

  useEffect(() => {
    // Read the library imperatively: the first render happens before persisted
    // state has hydrated, and a snapshot taken from that render would always be
    // empty. One read, once per mount, keeps today's mix stable while songs play.
    const library = useLibrary.getState();
    const artistScore = new Map<string, number>();
    const genreScore = new Map<string, number>();
    for (const track of library.recent) {
      const weight = 1 + (library.playStats[track.id]?.count ?? 0);
      if (track.artistId) artistScore.set(track.artistId, (artistScore.get(track.artistId) ?? 0) + weight);
      if (track.genre) genreScore.set(track.genre, (genreScore.get(track.genre) ?? 0) + weight);
    }
    const artists = [
      ...new Set([
        ...library.followedArtists.map((artist) => artist.id),
        ...[...artistScore.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
      ]),
    ].slice(0, 4);
    const genres = [...genreScore.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre)
      .slice(0, 3);
    const params = new URLSearchParams({ day: dayKey() });
    if (artists.length) params.set("artists", artists.join(","));
    if (genres.length) params.set("genres", genres.join(","));
    setSeedQuery(params.toString());
  }, []);

  const path = seedQuery ? `/api/home?provider=${provider}&${seedQuery}` : null;
  const { data, error, loading, reload } = useApi<HomeResponse>(path);

  const sections = data?.sections ?? [];
  const mix = sections.find((section) => section.id === "daily-mix");
  const mixTracks = (mix?.items as Track[] | undefined) ?? [];
  const shelves = sections.filter((section) => section.id !== "daily-mix");
  const genres = data?.genres ?? [];

  const mixTotal = useMemo(
    () => Math.round(mixTracks.reduce((sum, track) => sum + (track.duration || 0), 0) / 60),
    [mixTracks],
  );

  return (
    <div className="relative min-h-full">
      <SectionBackground section="home" />
      <div className="relative z-10 page-pad pb-10">
        <header className="flex items-center justify-between pb-2 pt-[max(env(safe-area-inset-top),14px)]">
          <Link href="/" className="font-display text-[21px] leading-none tracking-[-0.055em]">
            melo
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            className="glass press focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink/80 hover:text-ink"
          >
            <IconSettings size={17} />
          </Link>
        </header>

        <h1 className="page-head mt-1">Listen Now</h1>
        {clock && (
          <p className="mt-2 text-[12.5px] text-muted">
            {clock.greeting} · {clock.date}
          </p>
        )}

        {loading && !data && <HomeSkeleton />}

        {error && !data && (
          <EmptyState
            icon={<IconCloudOff size={20} />}
            title="Couldn't reach the music source"
            description={error}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="surface" onClick={reload}>
                  <IconRefresh size={14} /> Try again
                </Button>
                <Link href="/settings#source">
                  <Button variant="ghost">Open settings</Button>
                </Link>
              </div>
            }
          />
        )}

        {/* A source can answer with empty shelves instead of an error — what a
            host without a working yt-dlp does — and the page has to say so. */}
        {!loading &&
          !error &&
          data?.sections.every((section) => section.items.length === 0) &&
          !pinned.length &&
          !recent.length && (
          <EmptyState
            icon={<IconCloudOff size={20} />}
            title={`${PROVIDER_LABEL.youtube} answered, but with no songs`}
            description={`${PROVIDER_LABEL.youtube} returned no songs on this host. YouTube Music can block datacenter IPs or ask for cookies, so check the source before assuming the catalogue is empty.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="surface" onClick={reload}>
                  <IconRefresh size={14} /> Try again
                </Button>
                <Link href="/settings#source">
                  <Button variant="ghost">Check the source</Button>
                </Link>
              </div>
            }
          />
        )}

        {charts && charts.artists.length > 0 && (
          <section className="anim-fade mt-8">
            <SectionTitle
              title="Worldwide right now"
              subtitle="Artist rankings by monthly listeners · Spotify data from kworb.net"
              action={
                <span className="glass shrink-0 rounded-full px-2.5 py-1 text-[10.5px] uppercase tracking-[0.09em] text-muted">
                  {charts.updated ?? "live"}
                </span>
              }
            />
            <div className="glass-card overflow-hidden rounded-[18px] px-1.5 py-1.5">
              <div className="flex items-center gap-3 px-2.5 pb-1 pt-1.5 text-[9.5px] uppercase tracking-[0.1em] text-muted/80">
                <span className="w-6 shrink-0">#</span>
                <span className="min-w-0 flex-1">Artist</span>
                <span className="hidden w-20 shrink-0 text-right sm:block">Today</span>
                <span className="hidden w-20 shrink-0 text-right md:block">Monthly</span>
                <span className="w-9 shrink-0 text-right">Chart</span>
              </div>
              <div className="rise-list">
                {charts.artists.slice(0, 8).map((artist) => (
                  <div
                    key={artist.name}
                    className="chart-row group flex items-center gap-3 rounded-[11px] px-2.5 py-2 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
                  >
                    <span className="w-6 shrink-0 font-display text-[15px] tabular-nums text-muted transition-colors group-hover:text-ink">
                      {artist.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{artist.name}</span>
                    <span
                      className={cn(
                        "hidden w-20 shrink-0 items-center justify-end gap-1 text-right text-[11.5px] tabular-nums sm:flex",
                        artist.dailyChange >= 0 ? "text-[#7FDCC0]" : "text-[#F08C7E]",
                      )}
                    >
                      <span aria-hidden="true" className="text-[8px]">{artist.dailyChange >= 0 ? "\u25b2" : "\u25bc"}</span>
                      {compact(Math.abs(artist.dailyChange))}
                    </span>
                    <span className="hidden w-20 shrink-0 text-right text-[11.5px] tabular-nums text-muted md:block">
                      {compact(artist.monthlyListeners)} / mo
                    </span>
                    <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-muted">
                      {artist.worldwide ? `#${artist.worldwide.position}` : "\u2014"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted/80">
              Ranked by monthly listeners. The last column is the artist&apos;s best position on the worldwide
              daily chart.
            </p>
          </section>
        )}

        {pinned.length > 0 && (
          <section className="anim-fade mt-7">
            <SectionTitle title="Pinned" subtitle="Starred from the player · tap to play" />
            <Shelf>
              {pinned.map((track, index) => (
                <TrackCard key={`pin-${track.id}`} track={track} context={pinned} index={index} />
              ))}
            </Shelf>
          </section>
        )}

        {recent.length > 0 && (
          <section className="anim-fade mt-7">
            <SectionTitle
              title="Recently played"
              action={
                <Link
                  href="/library"
                  className="press flex items-center gap-1 text-[12px] text-muted hover:text-ink"
                >
                  See all <IconArrowRight size={13} />
                </Link>
              }
            />
            <Shelf>
              {recent.slice(0, 10).map((track, index) => (
                <TrackCard key={`recent-${track.id}`} track={track} context={recent.slice(0, 10)} index={index} />
              ))}
            </Shelf>
          </section>
        )}

        {mix && mixTracks.length > 0 && (
          <section className="anim-fade mt-8">
            <SectionTitle
              title={mix.title}
              subtitle={mix.subtitle}
              action={
                <button
                  onClick={() => playTracks(mixTracks, 0)}
                  aria-label="Play the whole mix"
                  className="press focus-ring glass flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-ink"
                >
                  <IconPlay size={12} /> Play
                </button>
              }
            />

            <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted">
              <IconDisc />
              <span>
                {mixTracks.length} songs · {mixTotal} min
                {data?.personalised ? " · from your plays on this device" : " · refreshes tomorrow"}
              </span>
            </div>

            <div className="glass-card rise-list mt-2 divide-y divide-[color-mix(in_srgb,var(--ink)_6%,transparent)] rounded-[18px] px-1.5 py-1">
              {(mixOpen ? mixTracks : mixTracks.slice(0, MIX_PREVIEW)).map((track, index) => (
                <TrackRow key={`mix-${track.id}`} track={track} index={index} context={mixTracks} />
              ))}
            </div>

            {mixTracks.length > MIX_PREVIEW && (
              <button
                onClick={() => setMixOpen((open) => !open)}
                className="press focus-ring mt-2 flex items-center gap-1 text-[12.5px] font-medium text-ink/75 hover:text-ink"
              >
                {mixOpen ? "Show less" : `Show all ${mixTracks.length}`}
                <IconChevronToggle open={mixOpen} />
              </button>
            )}

            <div className="mt-3 flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => playTracks(shuffle(mixTracks), 0)}>
                <IconShuffle size={14} /> Shuffle the mix
              </Button>
            </div>
          </section>
        )}

        {genres.length > 0 && (
          <section className="anim-fade mt-8">
            <SectionTitle title="Genres" subtitle="Browse the catalogue by sound" />
            <div className="rise-list mt-1 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {genres.map((genre) => (
                <Link
                  key={genre.name}
                  href={`/genre/${encodeURIComponent(genre.name)}`}
                  className="genre-tile press focus-ring group flex flex-col justify-end"
                >
                  <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
                    <Artwork
                      src={genre.artwork}
                      alt=""
                      rounded="rounded-none"
                      className="h-full w-full opacity-65 transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-105"
                      iconSize={18}
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(105deg,rgba(0,0,0,0.78)_6%,rgba(0,0,0,0.12)_64%,rgba(0,0,0,0.45))]"
                  />
                  <span className="relative z-10 px-3 py-3 text-[14px] font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
                    {genre.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {shelves.map((section, sectionIndex) => (
          <ShelfSection key={section.id} section={section} index={sectionIndex} />
        ))}

        {!loading && !error && !sections.length && (
          <EmptyState
            icon={<IconCloudOff size={20} />}
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
  );
}

function ShelfSection({ section, index }: { section: HomeSection; index: number }) {
  const items = section.items;
  return (
    <section className="anim-fade mt-8" style={{ animationDelay: `${Math.min(index, 3) * 40}ms` }}>
      <SectionTitle title={section.title} subtitle={section.subtitle} />
      {section.kind === "tracks" ? (
        <Shelf>
          {(items as Track[]).map((track, trackIndex) => (
            <TrackCard
              key={`${section.id}-${track.id}`}
              track={track}
              context={items as Track[]}
              index={trackIndex}
            />
          ))}
        </Shelf>
      ) : section.kind === "artists" ? (
        <Shelf>
          {(items as ArtistSummary[]).map((artist) => (
            <ArtistCard
              key={`${section.id}-${artist.id}`}
              href={`/artist/${encodeURIComponent(artist.id)}`}
              name={artist.name}
              artwork={artist.artwork}
              followers={artist.followerCount}
              className="w-[150px] shrink-0 snap-start sm:w-[168px]"
            />
          ))}
        </Shelf>
      ) : (
        <Shelf>
          {(items as AlbumSummary[]).map((album) => (
            <MediaCard
              key={`${section.id}-${album.id}`}
              href={`/album/${encodeURIComponent(album.id)}`}
              title={album.name}
              subtitle={album.artist}
              artwork={album.artwork}
              className="w-[150px] shrink-0 snap-start sm:w-[168px]"
            />
          ))}
        </Shelf>
      )}
    </section>
  );
}

function Shelf({ children }: { children: React.ReactNode }) {
  return <div className="shelf rise-list no-scrollbar mt-1">{children}</div>;
}

function shuffle(tracks: Track[]): Track[] {
  const out = [...tracks];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function IconDisc() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconChevronToggle({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="transition-transform duration-300"
      style={{ transform: open ? "rotate(180deg)" : undefined }}
    >
      <path d="M5.5 9 12 15.5 18.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function HomeSkeleton() {
  return (
    <div className="pt-6">
      <div className="shelf no-scrollbar flex gap-3.5 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-[152px] shrink-0">
            <Skeleton className="aspect-square w-full rounded-[6px]" />
            <Skeleton className="mt-2.5 h-3 w-3/4" />
            <Skeleton className="mt-1.5 h-2.5 w-1/2" />
          </div>
        ))}
      </div>
      <div className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-[12px]" />
        ))}
      </div>
      <div className="mt-9 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-[6px]" />
            <div className="flex-1">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="mt-1.5 h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
