"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Artwork } from "@/components/artwork";
import LyricsView from "@/components/lyrics-view";
import SeekBar from "@/components/seek-bar";
import {
  IconChevronDown,
  IconLyrics,
  IconMore,
  IconNext,
  IconPause,
  IconPin,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconShuffle,
  IconSpinner,
  IconVolume,
  IconVolumeOff,
} from "@/components/ui/icons";
import { useProgress } from "@/lib/progress";
import { cn } from "@/lib/cn";
import { useTrackArtwork } from "@/lib/use-track-artwork";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { useSettings } from "@/store/settings";
import { toast } from "@/store/toast";
import { useUi } from "@/store/ui";

/**
 * The player.
 *
 * A single enlarged, heavily blurred copy of the cover fills the screen and a
 * scrim sits over it, so the artwork sets the room's colour without ever
 * competing with the title. Everything you can press is white on that room,
 * laid out in the order a phone expects: what's playing, how far in, transport,
 * volume, then Lyrics / Shuffle / Repeat / Up next.
 */
export default function NowPlaying() {
  const windowOpen = useUi((s) => s.nowPlayingOpen);
  const sheetOpen = useUi((s) => Boolean(s.sheet));
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
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const pinned = useLibrary((s) => (track ? s.pinned.some((t) => t.id === track.id) : false));
  const togglePin = useLibrary((s) => s.togglePin);
  const settings = useSettings();
  const progress = useProgress();
  const artworkUrl = useTrackArtwork(track);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [pinJustChanged, setPinJustChanged] = useState(false);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (!windowOpen) {
      setLyricsOpen(false);
      setDragY(0);
    }
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

  if (!windowOpen || !track) return null;

  const duration = progress.duration || track.duration || 0;
  const remaining = Math.max(0, duration - progress.position);
  const volumePct = Math.round((muted ? 0 : volume) * 100);

  const onPin = () => {
    const nowPinned = togglePin(track);
    setPinJustChanged(true);
    window.setTimeout(() => setPinJustChanged(false), 420);
    toast(
      nowPinned ? `Pinned “${track.title}” to Home` : "Unpinned from Home",
      nowPinned ? "success" : "neutral",
      nowPinned ? { label: "Open Home", run: () => { close(); window.location.href = "/"; } } : undefined,
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] overflow-hidden bg-[var(--stage)] text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      style={{
        animation: "melo-sheet-up 0.42s cubic-bezier(.2,.8,.2,1) both",
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragStart.current === null ? "transform 0.28s cubic-bezier(.2,.8,.2,1)" : undefined,
      }}
    >
      <div className="absolute inset-0" aria-hidden="true">
        {artworkUrl && <div className="stage-art" style={{ backgroundImage: `url("${artworkUrl}")` }} />}
        <div className="stage-scrim" />
        <div className="stage-grain" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        {lyricsOpen ? (
          <div className="min-h-0 flex-1 pt-[env(safe-area-inset-top)]">
            <LyricsView track={track} onClose={() => setLyricsOpen(false)} tone="overlay" />
          </div>
        ) : (
          <>
            <header
              className="relative mx-auto flex w-full max-w-[560px] shrink-0 items-center justify-between px-3 pb-1 pt-[max(env(safe-area-inset-top),10px)]"
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
              <button
                onClick={close}
                aria-label="Close player"
                className="press focus-ring flex h-10 w-10 items-center justify-center rounded-full text-white/85 hover:bg-white/10 hover:text-white"
              >
                <IconChevronDown size={22} />
              </button>
              <span
                className={cn("h-[5px] w-10 rounded-full bg-white/25 transition-opacity", sheetOpen && "opacity-0")}
                aria-hidden="true"
              />
              <div className="h-10 w-10" aria-hidden="true" />
            </header>

            <div className="mx-auto flex min-h-0 w-full max-w-[440px] flex-1 flex-col px-5 pb-[max(env(safe-area-inset-bottom),10px)] lg:max-w-[900px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-center lg:gap-16 lg:px-10">
              <div className="flex min-h-0 flex-1 items-center justify-center py-2 lg:py-0">
                <div className="relative w-[min(78vw,330px,42vh)] lg:w-full lg:max-w-[380px]">
                  {settings.nowPlaying.glow && (
                    <div
                      aria-hidden="true"
                      className="absolute -inset-8 -z-10 rounded-[40px] bg-white/6 blur-3xl"
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
                            ? "rounded-[6px]"
                            : "rounded-[20px]"
                      }
                      className="aspect-square w-full shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)] ring-1 ring-white/12"
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-0 shrink-0">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h1 className="line-clamp-2 text-[clamp(22px,5.6vw,29px)] font-semibold leading-[1.18] tracking-[-0.025em] text-white">
                      {track.title}
                    </h1>
                    <p className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[14.5px] leading-tight text-white/58">
                      {track.artistId ? (
                        <Link
                          href={`/artist/${encodeURIComponent(track.artistId)}`}
                          onClick={close}
                          className="font-medium text-white/85 hover:underline"
                        >
                          {track.artist}
                        </Link>
                      ) : (
                        <span className="font-medium text-white/85">{track.artist}</span>
                      )}
                      {track.featuredArtists.length > 0 && (
                        <span className="truncate">feat. {track.featuredArtists.join(", ")}</span>
                      )}
                      {track.album && (
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          <span aria-hidden="true" className="text-white/30">
                            ·
                          </span>
                          {track.albumId ? (
                            <Link
                              href={`/album/${encodeURIComponent(track.albumId)}`}
                              onClick={close}
                              className="truncate hover:text-white hover:underline"
                            >
                              {track.album}
                            </Link>
                          ) : (
                            <span className="truncate">{track.album}</span>
                          )}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={onPin}
                      aria-pressed={pinned}
                      aria-label={pinned ? "Unpin from Home" : "Pin to Home"}
                      title={pinned ? "Unpin from Home" : "Pin to Home"}
                      className={cn(
                        "press focus-ring flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        pinned ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <span
                        className="transition-transform duration-300"
                        style={{ transform: pinJustChanged ? "scale(1.22)" : "scale(1)" }}
                      >
                        <IconPin size={21} filled={pinned} />
                      </span>
                    </button>
                    <button
                      onClick={() => openSheet({ type: "trackMenu", track })}
                      aria-label="More options"
                      className="press focus-ring glass flex h-9 w-9 items-center justify-center rounded-full text-white/85 hover:text-white"
                    >
                      <IconMore size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <SeekBar
                    className="[&_.seek-rail]:bg-white/22 [&_.seek-fill]:bg-white [&_.seek-knob]:bg-white"
                    showTimes={false}
                  />
                  <div className="mt-0.5 flex items-center justify-between text-[11.5px] font-medium tabular-nums text-white/60">
                    <span>{formatClock(progress.position)}</span>
                    <span>
                      {settings.nowPlaying.showRemaining
                        ? `-${formatClock(remaining)}`
                        : formatClock(duration)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between px-1">
                  <button
                    onClick={prev}
                    aria-label="Previous song"
                    className="press focus-ring flex h-12 w-12 items-center justify-center rounded-full text-white/90 hover:text-white"
                  >
                    <IconPrev size={34} />
                  </button>
                  <button
                    onClick={toggle}
                    aria-label={progress.playing ? "Pause" : "Play"}
                    className="press focus-ring flex h-[68px] w-[68px] items-center justify-center rounded-full text-white"
                  >
                    {progress.loading && !progress.playing ? (
                      <IconSpinner size={40} />
                    ) : progress.playing ? (
                      <IconPause size={50} />
                    ) : (
                      <IconPlay size={50} className="ml-1" />
                    )}
                  </button>
                  <button
                    onClick={() => next()}
                    aria-label="Next song"
                    className="press focus-ring flex h-12 w-12 items-center justify-center rounded-full text-white/90 hover:text-white"
                  >
                    <IconNext size={34} />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={toggleMute}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="press focus-ring flex h-7 w-7 shrink-0 items-center justify-center text-white/55 hover:text-white"
                  >
                    {muted || volume === 0 ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    aria-label="Volume"
                    onChange={(event) => setVolume(Number(event.target.value))}
                    className="vol-slider min-w-0 flex-1"
                    style={{
                      background: `linear-gradient(to right, rgba(255,255,255,0.92) ${volumePct}%, rgba(255,255,255,0.2) ${volumePct}%)`,
                    }}
                  />
                  <IconVolume size={16} className="shrink-0 text-white/30" />
                </div>

                <div className="mt-1 flex items-center justify-between px-0.5">
                  <DockButton label="Lyrics" onClick={() => setLyricsOpen(true)}>
                    <IconLyrics size={21} />
                  </DockButton>
                  <DockButton label={shuffle ? "Shuffle on" : "Shuffle off"} active={shuffle} onClick={toggleShuffle}>
                    <IconShuffle size={21} />
                  </DockButton>
                  <DockButton
                    label={repeat === "off" ? "Repeat off" : repeat === "one" ? "Repeat one" : "Repeat all"}
                    active={repeat !== "off"}
                    onClick={cycleRepeat}
                  >
                    <IconRepeat size={21} one={repeat === "one"} />
                  </DockButton>
                  <DockButton label="Up next" onClick={() => openSheet({ type: "queue" })}>
                    <IconQueue size={21} />
                  </DockButton>
                </div>
              </div>
            </div>
          </>
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

function DockButton({
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
      aria-pressed={active}
      className={cn(
        "press focus-ring relative flex h-11 w-11 items-center justify-center rounded-full transition-colors",
        active ? "text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
      {active && <span className="absolute bottom-1 h-[3px] w-[3px] rounded-full bg-white" aria-hidden="true" />}
    </button>
  );
}
