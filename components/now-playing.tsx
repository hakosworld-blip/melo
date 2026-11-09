"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Download,
  ListMusic,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import { Artwork } from "@/components/artwork";
import SeekBar from "@/components/seek-bar";
import SectionBackground from "@/components/section-background";
import LyricsView from "@/components/lyrics-view";
import { IconButton } from "@/components/ui/primitives";
import { PROVIDER_LABEL } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { useTrackArtwork } from "@/lib/use-track-artwork";
import { useProgress } from "@/lib/progress";
import { useDownloads } from "@/store/downloads";
import { usePlayer } from "@/store/player";
import { useSettings } from "@/store/settings";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";

export default function NowPlaying() {
  const windowOpen = useUi((s) => s.nowPlayingOpen);
  const close = useUi((s) => s.closeNowPlaying);
  const openSheet = useUi((s) => s.openSheet);
  const track = usePlayer((s) => s.queue[s.index]);
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const repeat = usePlayer((s) => s.repeat);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const shuffle = usePlayer((s) => s.shuffle);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const download = useDownloads((s) => (track ? s.records[track.id] : undefined));
  const enqueue = useDownloads((s) => s.enqueue);
  const settings = useSettings();
  const progress = useProgress();
  const artworkUrl = useTrackArtwork(track);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!windowOpen) setLyricsOpen(false);
  }, [windowOpen]);

  useEffect(() => {
    if (!windowOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lyricsOpen) setLyricsOpen(false);
        else close();
      }
      if (event.key === " " && !(event.target as HTMLElement)?.closest("input, textarea, button")) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [windowOpen, lyricsOpen, close, toggle]);

  const remainingOrDuration = useMemo(() => {
    const duration = progress.duration || track?.duration || 0;
    return `${Math.max(0, duration - progress.position)}`;
  }, [progress.duration, progress.position, track?.duration]);

  if (!windowOpen || !track) return null;

  const handleDownload = () => {
    if (!download || download.status === "failed") {
      enqueue(track);
      toast(track.downloadable ? "Downloading for offline listening" : "Saving a private offline copy", "neutral");
      return;
    }
    if (download.status === "complete") {
      toast(download.authorised ? "Already downloaded" : "Already saved offline", "success");
    }
  };

  const downloadIcon =
    download?.status === "complete" ? (
      <Check size={17} />
    ) : download?.status === "downloading" || download?.status === "queued" ? (
      <Loader2 size={17} className="anim-spin" />
    ) : download?.status === "failed" ? (
      <AlertCircle size={17} />
    ) : (
      <Download size={17} />
    );

  return (
    <div
      /* The player is a dark stage on purpose: blurred artwork behind warm-charcoal, bone text. */
      className="fixed inset-0 z-[70] overflow-hidden bg-[#141312] text-[#f4f1ec]"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      style={{
        animation: "melo-sheet-up 0.42s cubic-bezier(.2,.8,.2,1) both",
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragStart.current === null ? "transform 0.28s cubic-bezier(.2,.8,.2,1)" : undefined,
      }}
    >
      <SectionBackground section="nowPlaying" artworkUrl={track.artwork} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(20,19,18,0.58), rgba(20,19,18,0.9) 62%, rgba(20,19,18,0.97))",
        }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <header
          className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pb-1 pt-[max(env(safe-area-inset-top),12px)]"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStart.current === null) return;
            const delta = event.clientY - dragStart.current;
            if (delta > 0) setDragY(delta);
          }}
          onPointerUp={() => {
            const delta = dragY;
            dragStart.current = null;
            setDragY(0);
            if (delta > 110) close();
          }}
        >
          <IconButton label="Close player" onClick={close} className="text-white/80 hover:text-white hover:bg-white/10">
            <ChevronLeft size={20} className="sm:hidden" />
            <ChevronLeft size={20} className="hidden rotate-90 sm:block" />
          </IconButton>
          <div className="min-w-0 text-center">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              {lyricsOpen ? "Lyrics" : "Now playing"}
            </p>
            <p className="truncate text-[11.5px] text-white/70">{PROVIDER_LABEL[track.provider]}</p>
          </div>
          <IconButton
            label="More options"
            onClick={() => openSheet({ type: "trackMenu", track })}
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <MoreHorizontal size={19} />
          </IconButton>
        </header>

        {lyricsOpen ? (
          <div className="min-h-0 flex-1">
            <LyricsView track={track} onClose={() => setLyricsOpen(false)} tone="overlay" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden px-5 pb-[max(env(safe-area-inset-bottom),18px)]">
            <div className="mx-auto flex h-full w-full max-w-[520px] flex-col justify-center gap-3.5 py-1 lg:max-w-5xl lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:py-8">
              <div className="relative mx-auto w-[min(70vw,320px,33vh)] shrink-0 lg:w-full lg:max-w-none">
                {settings.nowPlaying.glow && (
                  <div
                    className="absolute -inset-6 -z-10 rounded-[24px] opacity-70 blur-2xl transition-opacity duration-700"
                    style={{ background: "rgba(244,241,236,0.08)" }}
                  />
                )}
                <div key={track.id} className="anim-scale">
                  <Artwork
                    src={artworkUrl}
                    alt={track.title}
                    eager
                    iconSize={44}
                    rounded={
                      settings.nowPlaying.artworkStyle === "circle"
                        ? "rounded-full"
                        : settings.nowPlaying.artworkStyle === "square"
                          ? "rounded-[4px]"
                          : "rounded-[calc(var(--radius)+6px)]"
                    }
                    className="aspect-square w-full shadow-[var(--shadow-art)] ring-1 ring-white/10"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
                  <h1 className="font-display line-clamp-2 text-[clamp(24px,5.4vw,36px)] leading-[1.04] text-white">
                    {track.title}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[14px] text-white/75 lg:justify-start">
                    {track.artistId ? (
                      <Link
                        href={`/artist/${encodeURIComponent(track.artistId)}`}
                        onClick={close}
                        className="font-medium text-white/90 hover:underline"
                      >
                        {track.artist}
                      </Link>
                    ) : (
                      <span className="font-medium text-white/90">{track.artist}</span>
                    )}
                    {track.featuredArtists.length > 0 && (
                      <span className="text-white/60">feat. {track.featuredArtists.join(", ")}</span>
                    )}
                    {track.album && (
                      <>
                        <span className="text-white/35">·</span>
                        {track.albumId ? (
                          <Link
                            href={`/album/${encodeURIComponent(track.albumId)}`}
                            onClick={close}
                            className="text-white/65 hover:underline"
                          >
                            {track.album}
                          </Link>
                        ) : (
                          <span className="text-white/65">{track.album}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <SeekBar
                    className="[&_.seek-rail]:bg-white/20 [&_.seek-fill]:bg-white [&_.seek-knob]:bg-white"
                    showTimes={false}
                  />
                  <div className="mt-1 flex items-center justify-between text-[11.5px] tabular-nums text-white/55">
                    <span>{formatClock(progress.position)}</span>
                    <span>
                      {settings.nowPlaying.showRemaining ? `-${formatClock(Number(remainingOrDuration))}` : formatClock(progress.duration || track.duration)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <IconButton
                    label={shuffle ? "Shuffle on" : "Shuffle off"}
                    active={shuffle}
                    onClick={toggleShuffle}
                    className={cn("h-10 w-10", shuffle ? "!text-white" : "text-white/60 hover:!text-white hover:!bg-white/10")}
                  >
                    <Shuffle size={17} />
                  </IconButton>
                  <IconButton
                    label="Previous"
                    onClick={prev}
                    className="h-11 w-11 text-white/85 hover:!text-white hover:!bg-white/10"
                  >
                    <SkipBack size={22} fill="currentColor" />
                  </IconButton>
                  <button
                    onClick={toggle}
                    aria-label={progress.playing ? "Pause" : "Play"}
                    className="press focus-ring flex h-[68px] w-[68px] items-center justify-center rounded-full bg-white text-black shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)]"
                  >
                    {progress.loading && !progress.playing ? (
                      <Loader2 size={26} className="anim-spin" />
                    ) : progress.playing ? (
                      <Pause size={26} fill="currentColor" />
                    ) : (
                      <Play size={26} fill="currentColor" className="ml-1" />
                    )}
                  </button>
                  <IconButton
                    label="Next"
                    onClick={() => next()}
                    className="h-11 w-11 text-white/85 hover:!text-white hover:!bg-white/10"
                  >
                    <SkipForward size={22} fill="currentColor" />
                  </IconButton>
                  <IconButton
                    label={repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat all" : "Repeat one"}
                    active={repeat !== "off"}
                    onClick={cycleRepeat}
                    className={cn("h-10 w-10", repeat !== "off" ? "!text-white" : "text-white/60 hover:!text-white hover:!bg-white/10")}
                  >
                    {repeat === "one" ? <Repeat1 size={17} /> : <Repeat size={17} />}
                  </IconButton>
                </div>

                <div className="mt-3 flex items-center justify-center gap-1 lg:justify-start">
                  <ActionButton label="Lyrics" onClick={() => setLyricsOpen(true)}>
                    <LyricsGlyph />
                  </ActionButton>
                  <ActionButton label="Queue" onClick={() => openSheet({ type: "queue" })}>
                    <ListMusic size={18} />
                  </ActionButton>
                  <ActionButton label="Add to playlist" onClick={() => openSheet({ type: "addToPlaylist", track })}>
                    <Plus size={18} />
                  </ActionButton>
                  <ActionButton
                    label={download?.status === "complete" ? "Saved offline" : "Download"}
                    onClick={handleDownload}
                    active={download?.status === "complete"}
                  >
                    {downloadIcon}
                  </ActionButton>
                  <div className="ml-1 hidden text-[11px] leading-tight text-white/40 sm:block">
                    {download?.status === "downloading" ? `${Math.round(download.progress * 100)}% saved` : ""}
                  </div>
                </div>

                {track.downloadable === false && download?.status === "complete" && (
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35 lg:text-left">
                    Saved as a private offline copy. The artist hasn&apos;t enabled downloads of this file.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "press focus-ring flex h-10 w-10 items-center justify-center rounded-full transition-colors",
        active ? "text-white bg-white/15" : "text-white/60 hover:text-white hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function LyricsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 6h14M5 11h9M5 16h11M5 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
