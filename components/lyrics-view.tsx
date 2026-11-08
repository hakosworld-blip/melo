"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, RefreshCw, Search, X } from "lucide-react";
import { Button, EmptyState, IconButton, Skeleton, Spinner } from "@/components/ui/primitives";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { useProgress } from "@/lib/progress";
import { KEYS, idbGet, idbSet } from "@/lib/storage";
import { usePlayer } from "@/store/player";
import { useSettings } from "@/store/settings";
import { toast } from "@/store/toast";
import type { Lyrics, Track } from "@/lib/types";

/**
 * Lyrics screen.
 * - Downloads first, then LRCLIB (cached in IndexedDB).
 * - Synced lines highlight + auto-scroll + tap-to-seek when timestamps exist.
 * - Unsynced lyrics are labelled as such; nothing is faked.
 * - If nothing matches, the user can search LRCLIB manually and attach a match.
 */
export default function LyricsView({
  track,
  onClose,
  tone = "panel",
}: {
  track: Track;
  onClose?: () => void;
  tone?: "panel" | "overlay";
}) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(`${track.title} ${track.artist}`);
  const [results, setResults] = useState<Lyrics[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const progress = useProgress();
  const seek = usePlayer((s) => s.seek);
  const settings = useSettings((s) => s.lyrics);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const manualUntil = useRef(0);
  const overlay = tone === "overlay";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLyrics(null);
    setError(null);
    setNotFound(false);
    setResults(null);
    setSearchOpen(false);

    (async () => {
      const saved = (await idbGet<string>(KEYS.lyrics(track.id))) ?? (await idbGet<string>(`lyrics-cache:${track.id}`));
      let local: Lyrics | null = null;
      if (saved) {
        try {
          local = JSON.parse(saved) as Lyrics;
        } catch {
          local = null;
        }
      }
      if (cancelled) return;
      if (local) {
        setLyrics(local);
        setLoading(false);
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!local) {
          setError("You're offline. Download a track to keep its lyrics on this device.");
          setLoading(false);
        }
        return;
      }

      const params = new URLSearchParams({ title: track.title, artist: track.artist });
      if (track.album) params.set("album", track.album);
      if (track.duration) params.set("duration", String(Math.round(track.duration)));
      try {
        const payload = await apiGet<{ lyrics: Lyrics | null }>(`/api/lyrics?${params.toString()}`);
        if (cancelled) return;
        if (payload.lyrics) {
          setLyrics(payload.lyrics);
          void idbSet(`lyrics-cache:${track.id}`, JSON.stringify(payload.lyrics));
          setNotFound(false);
        } else if (!local) {
          setNotFound(true);
        }
      } catch (err) {
        if (!cancelled && !local) setError(err instanceof Error ? err.message : "Lyrics lookup failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [track.id, track.title, track.artist, track.album, track.duration, tick]);

  const activeIndex = useMemo(() => {
    if (!lyrics?.synced) return -1;
    const position = progress.position + 0.12;
    let index = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= position) index = i;
      else break;
    }
    return index;
  }, [lyrics, progress.position]);

  useEffect(() => {
    if (!settings.autoScroll || activeIndex < 0) return;
    if (Date.now() < manualUntil.current) return;
    const container = scrollRef.current;
    const line = lineRefs.current[activeIndex];
    if (!container || !line) return;
    const target = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex, settings.autoScroll]);

  const markManualScroll = () => {
    manualUntil.current = Date.now() + 6000;
  };

  const saveOffline = async () => {
    if (!lyrics) return;
    const ok = await idbSet(KEYS.lyrics(track.id), JSON.stringify(lyrics));
    toast(ok ? "Lyrics saved for offline listening" : "Couldn't save lyrics", ok ? "success" : "error");
  };

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const payload = await apiGet<{ results: Lyrics[] }>(`/api/lyrics?q=${encodeURIComponent(query.trim())}`);
      setResults(payload.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Lyrics search failed");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const attach = async (match: Lyrics) => {
    const ok = await idbSet(KEYS.lyrics(track.id), JSON.stringify(match));
    setLyrics(match);
    setSearchOpen(false);
    setResults(null);
    toast(ok ? "Lyrics attached to this track" : "Couldn't save lyrics", ok ? "success" : "error");
  };

  const muted = overlay ? "text-white/45" : "text-muted";
  const strong = overlay ? "text-white" : "text-ink";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 pb-2 pt-1 sm:px-6">
        {onClose && (
          <IconButton
            label="Back"
            onClick={onClose}
            className={overlay ? "text-white/75 hover:!text-white hover:!bg-white/10" : ""}
          >
            <ArrowLeft size={18} />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] uppercase tracking-[0.16em]", muted)}>Lyrics</p>
          <p className={cn("truncate text-[13px] font-medium", strong)}>
            {track.title} <span className={muted}>· {track.artist}</span>
          </p>
        </div>
        {lyrics && (
          <div className={cn("hidden items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] sm:flex", muted)}>
            <span className="rounded-full border border-current/25 px-2 py-0.5">LRCLIB</span>
            <span className={cn("rounded-full px-2 py-0.5", lyrics.synced ? "bg-accent/15 text-accent" : "border border-current/25")}>
              {lyrics.synced ? "Synced" : "Unsynced"}
            </span>
          </div>
        )}
        <IconButton
          label="Search lyrics"
          onClick={() => setSearchOpen((v) => !v)}
          className={overlay ? "text-white/75 hover:!text-white hover:!bg-white/10" : ""}
        >
          <Search size={17} />
        </IconButton>
        {lyrics && (
          <IconButton
            label="Save lyrics offline"
            onClick={saveOffline}
            className={overlay ? "text-white/75 hover:!text-white hover:!bg-white/10" : ""}
          >
            <Download size={17} />
          </IconButton>
        )}
      </div>

      {searchOpen ? (
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 sm:px-6">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runSearch()}
              placeholder="Search title or artist…"
              className={cn(
                "h-10 min-w-0 flex-1 rounded-full border px-4 text-[13px] outline-none transition-colors",
                overlay
                  ? "border-white/15 bg-white/10 text-white placeholder:text-white/35 focus:border-white/35"
                  : "border-line bg-surface text-ink placeholder:text-muted focus:border-[color-mix(in_srgb,var(--accent)_50%,var(--line))]",
              )}
            />
            <Button variant={overlay ? "surface" : "surface"} onClick={runSearch} disabled={searching}>
              {searching ? <Spinner /> : "Search"}
            </Button>
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-6">
            {searching && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            )}
            {searchError && <p className="py-6 text-center text-[13px] text-[#f08c7e]">{searchError}</p>}
            {results && results.length === 0 && (
              <p className={cn("py-8 text-center text-[13px]", muted)}>No lyrics matched that search.</p>
            )}
            {results && results.length > 0 && (
              <div className="space-y-1.5">
                {results.map((match) => (
                  <button
                    key={`${match.lrclibId}-${match.albumName}`}
                    onClick={() => attach(match)}
                    className={cn(
                      "press flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left",
                      overlay
                        ? "border-white/10 bg-white/5 hover:bg-white/10"
                        : "border-line bg-surface hover:bg-[color-mix(in_srgb,var(--ink)_5%,var(--surface))]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-[13px] font-medium", strong)}>{match.trackName}</p>
                      <p className={cn("truncate text-[11.5px]", muted)}>
                        {match.artistName}
                        {match.albumName ? ` · ${match.albumName}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                        match.synced ? "bg-accent/15 text-accent" : "border border-current/20",
                        !match.synced && muted,
                      )}
                    >
                      {match.synced ? "Synced" : "Text"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!searching && !results && (
              <p className={cn("py-8 text-center text-[13px] leading-relaxed", muted)}>
                Search LRCLIB for the right match. Picking one attaches it to this track and keeps it on your device.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onWheel={markManualScroll}
          onTouchMove={markManualScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 sm:px-6"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="mx-auto w-full max-w-3xl">
            {loading && !lyrics && (
              <div className="space-y-4 pt-8">
                {[70, 90, 55, 80, 65, 88, 50, 75].map((width, i) => (
                  <Skeleton key={i} className="h-5" />
                ))}
              </div>
            )}

            {!loading && error && (
              <EmptyState
                icon={<AlertGlyph />}
                title="Lyrics unavailable"
                description={error}
                action={
                  <div className="flex gap-2">
                    <Button variant="surface" onClick={() => setTick((t) => t + 1)}>
                      <RefreshCw size={14} /> Try again
                    </Button>
                    <Button variant="ghost" onClick={() => setSearchOpen(true)}>
                      Search lyrics
                    </Button>
                  </div>
                }
              />
            )}

            {!loading && !error && notFound && !lyrics && (
              <EmptyState
                icon={<Search size={20} />}
                title="No lyrics found for this track"
                description="LRCLIB is community-sourced and doesn't cover everything. You can search for the right match yourself."
                action={<Button variant="surface" onClick={() => setSearchOpen(true)}>Search lyrics</Button>}
              />
            )}

            {lyrics?.instrumental && (
              <EmptyState icon={<MusicGlyph />} title="Instrumental" description="LRCLIB lists this track as an instrumental." />
            )}

            {lyrics && !lyrics.instrumental && lyrics.lines.length > 0 && (
              <div
                className={cn(
                  "py-10",
                  settings.align === "center" ? "text-center" : "text-left",
                )}
              >
                {!lyrics.synced && (
                  <p className={cn("mb-6 text-[11px] uppercase tracking-[0.14em]", muted)}>
                    Not time-synced · lyrics only
                  </p>
                )}
                {lyrics.lines.map((line, index) => {
                  const isActive = lyrics.synced && index === activeIndex;
                  const isPast = lyrics.synced && index < activeIndex;
                  const wordIndex =
                    isActive && line.words
                      ? line.words.reduce((acc, word, i) => (word.t <= progress.position + 0.08 ? i : acc), -1)
                      : -1;
                  return (
                    <button
                      key={`${line.time}-${index}`}
                      ref={(el) => {
                        lineRefs.current[index] = el;
                      }}
                      onClick={() => lyrics.synced && seek(line.time)}
                      disabled={!lyrics.synced}
                      data-active={isActive}
                      data-highlight={settings.highlight}
                      className={cn(
                        "lyric block w-full py-[7px] text-left leading-[1.28]",
                        settings.align === "center" && "text-center",
                        !lyrics.synced && "cursor-default",
                        isActive && "font-semibold",
                        isPast && "opacity-80",
                      )}
                      style={{
                        fontSize: `${settings.fontSize}px`,
                        color: overlay && !lyrics.synced ? "rgba(255,255,255,0.62)" : undefined,
                      }}
                    >
                      {line.text || "♪"}
                      {wordIndex >= 0 && line.words && (
                        <span className="sr-only">{line.words.map((w) => w.w).join(" ")}</span>
                      )}
                      {wordIndex >= 0 && line.words && (
                        <span aria-hidden="true" className="absolute opacity-0 pointer-events-none">
                          {line.words[wordIndex]?.w}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={cn("px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 text-[10.5px]", muted)}>
        Lyrics from LRCLIB · community-sourced, may be incomplete
      </div>
    </div>
  );
}

function AlertGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MusicGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
