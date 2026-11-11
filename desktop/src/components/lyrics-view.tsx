"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, EmptyState, IconButton, Skeleton, Spinner } from "@/components/ui/primitives";
import {
  IconArrowRight,
  IconChevronLeft,
  IconCloudOff,
  IconDownload,
  IconInfo,
  IconMusic,
  IconRefresh,
  IconSearch,
} from "@/components/ui/icons";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useProgress } from "@/lib/progress";
import { KEYS, idbGet, idbSet } from "@/lib/storage";
import { usePlayer } from "@/store/player";
import { useSettings } from "@/store/settings";
import { toast } from "@/store/toast";
import type { Lyrics, Track } from "@/lib/types";

/** How many lines either side of the sung line stay in focus. */
function focusFor(index: number, active: number, synced: boolean): "active" | "mid" | "near" | "far" | "static" {
  if (!synced) return "static";
  if (index === active) return "active";
  const distance = Math.abs(index - active);
  if (distance === 1) return "mid";
  if (distance === 2) return "near";
  return "far";
}

/**
 * Lyrics.
 *
 * Downloads first, then LRCLIB (cached on the device). Synced lines highlight,
 * auto-scroll and seek on tap. The sheet keeps a readable band in the middle of
 * the screen: the lines above and below it fade and lose focus, so the eye
 * lands on the line being sung. The source sits at the end of the sheet, after
 * the last line, rather than in a permanent footer.
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
  const iconTone = overlay ? "text-white/75 hover:!text-white hover:!bg-white/10" : "";
  const source = lyrics ? (lyrics.synced ? "Time-synced by LRCLIB" : "Text lyrics from LRCLIB") : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-3 pb-1 pt-1 sm:px-6">
        {onClose && (
          <IconButton label="Back to player" onClick={onClose} className={iconTone}>
            <IconChevronLeft size={20} />
          </IconButton>
        )}
        <div className="min-w-0 flex-1 px-1">
          <p className={cn("truncate text-[15px] font-semibold tracking-[-0.01em]", strong)}>{track.title}</p>
          <p className={cn("truncate text-[12px]", muted)}>{track.artist}</p>
        </div>
        <IconButton label="Search lyrics" onClick={() => setSearchOpen((v) => !v)} className={iconTone}>
          <IconSearch size={18} />
        </IconButton>
        {lyrics && (
          <IconButton label="Save lyrics offline" onClick={saveOffline} className={iconTone}>
            <IconDownload size={18} />
          </IconButton>
        )}
      </div>

      {searchOpen ? (
        <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 sm:px-6">
          <div className="mt-2 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runSearch()}
              placeholder="Search title or artist…"
              className={cn(
                "h-10 min-w-0 flex-1 rounded-full border px-4 text-[13px] outline-none transition-colors",
                overlay
                  ? "border-white/15 bg-white/10 text-white placeholder:text-white/35 focus:border-white/40"
                  : "border-line bg-surface text-ink placeholder:text-muted focus:border-white/30",
              )}
            />
            <Button variant="surface" onClick={runSearch} disabled={searching}>
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
                      overlay ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-line bg-surface hover:bg-surface2",
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
                        match.synced ? "bg-white/15 text-white" : "border border-current/20",
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
          className={cn("lyrics-scroll min-h-0 flex-1 overflow-y-auto px-5 sm:px-8", !overlay && "pt-2")}
          style={{ scrollbarWidth: "none" }}
        >
          <div className={cn("mx-auto w-full max-w-2xl", settings.align === "center" ? "text-center" : "text-left")}>
            {loading && !lyrics && (
              <div className="space-y-4 pt-16">
                {[70, 90, 55, 80, 65, 88, 50, 75].map((width, i) => (
                  <Skeleton key={i} className="h-5" />
                ))}
              </div>
            )}

            {!loading && error && (
              <EmptyState
                icon={<IconCloudOff size={20} />}
                title="Lyrics unavailable"
                description={error}
                action={
                  <div className="flex gap-2">
                    <Button variant="surface" onClick={() => setTick((t) => t + 1)}>
                      <IconRefresh size={14} /> Try again
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
                icon={<IconSearch size={20} />}
                title="No lyrics found for this track"
                description="LRCLIB is community-sourced and doesn't cover everything. You can search for the right match yourself."
                action={
                  <Button variant="surface" onClick={() => setSearchOpen(true)}>
                    Search lyrics
                  </Button>
                }
              />
            )}

            {lyrics?.instrumental && (
              <EmptyState
                icon={<IconMusic size={20} />}
                title="Instrumental"
                description="LRCLIB lists this track as an instrumental, so there's nothing to sing along to."
              />
            )}

            {lyrics && !lyrics.instrumental && lyrics.lines.length > 0 && (
              <>
                <div className="pb-2 pt-[26vh]">
                  {!lyrics.synced && (
                    <p className={cn("mb-5 flex items-center gap-1.5 text-[11.5px]", muted)}>
                      <IconInfo size={13} /> Not time-synced — lyrics only
                    </p>
                  )}
                  {lyrics.lines.map((line, index) => {
                    const isActive = lyrics.synced && index === activeIndex;
                    const focus = focusFor(index, activeIndex, lyrics.synced);
                    return (
                      <button
                        key={`${line.time}-${index}`}
                        ref={(el) => {
                          lineRefs.current[index] = el;
                        }}
                        onClick={() => lyrics.synced && seek(line.time)}
                        disabled={!lyrics.synced}
                        data-active={isActive}
                        data-focus={focus}
                        data-highlight={settings.highlight}
                        className={cn(
                          "lyric block w-full text-left font-semibold leading-[1.24]",
                          settings.align === "center" && "text-center",
                          !lyrics.synced && "cursor-default font-medium leading-[1.45]",
                          overlay
                            ? isActive
                              ? "text-white"
                              : "text-white/70"
                            : isActive
                              ? "text-ink"
                              : "text-ink/70",
                        )}
                        style={{
                          fontSize: `clamp(18px, ${Math.min(settings.fontSize, 34) / 16}rem, 34px)`,
                          paddingBlock: lyrics.synced ? "9px" : "7px",
                          opacity: isActive ? 1 : undefined,
                        }}
                      >
                        {line.text || "♪"}
                      </button>
                    );
                  })}
                </div>

                <div className={cn("mb-[18vh] mt-6 border-t pt-5", overlay ? "border-white/10" : "border-line")}>
                  <p className={cn("text-[11px] uppercase tracking-[0.14em]", muted)}>Lyrics source</p>
                  <a
                    href="https://lrclib.net"
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "group mt-1.5 inline-flex items-center gap-1.5 text-[14px] font-medium hover:underline",
                      strong,
                    )}
                  >
                    LRCLIB
                    <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </a>
                  <p className={cn("mt-1 text-[12px] leading-relaxed", muted)}>
                    {source}
                    {lyrics.trackName ? ` · matched to “${lyrics.trackName}”` : ""}
                    {lyrics.artistName ? ` by ${lyrics.artistName}` : ""}. Community-contributed and may be
                    incomplete or timed slightly off.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
