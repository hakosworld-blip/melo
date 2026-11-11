"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { progressStore } from "@/lib/progress";
import {
  applyMediaSession,
  audioElement,
  releaseSource,
  resolveSource,
  setMediaPlaybackState,
  setObjectUrl,
  streamPath,
  updatePositionState,
  whenMetadata,
} from "@/lib/player-engine";
import { useDownloads } from "@/store/downloads";
import { useLibrary } from "@/store/library";
import type { Track } from "@/lib/types";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  queue: Track[];
  index: number;
  repeat: RepeatMode;
  shuffle: boolean;
  volume: number;
  muted: boolean;
  error: string | null;
  hydrated: boolean;
  playTracks: (tracks: Track[], startIndex?: number) => void;
  playTrack: (track: Track, context?: Track[]) => void;
  playAt: (index: number) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  seek: (seconds: number) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (track: Track) => void;
  addManyToQueue: (tracks: Track[]) => void;
  addNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  hydrate: () => void;
  dismissError: () => void;
}

const POSITION_KEY = "melo-position";

let bound = false;
let shuffleBackup: Track[] | null = null;
let lastSaved = 0;
let lastPositionState = 0;

function readSavedPosition(): { id: string; position: number } | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    return raw ? (JSON.parse(raw) as { id: string; position: number }) : null;
  } catch {
    return null;
  }
}

function savePosition(trackId: string, position: number) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify({ id: trackId, position }));
  } catch {
    /* storage may be full or blocked — playback continues regardless */
  }
}

async function loadTrack(track: Track, opts: { position?: number; autoplay?: boolean } = {}) {
  bindEvents();
  const el = audioElement();
  const state = usePlayer.getState();
  el.volume = state.muted ? 0 : state.volume;

  progressStore.update({
    position: opts.position ?? 0,
    duration: track.duration || 0,
    buffered: 0,
    loading: true,
    playing: false,
  });

  const downloaded = useDownloads.getState().records[track.id]?.status === "complete";
  let src: string;
  try {
    src = await resolveSource(track, downloaded);
  } catch {
    src = streamPath(track);
  }

  releaseSource();
  if (src.startsWith("blob:")) setObjectUrl(src);
  el.src = src;
  el.load();
  applyMediaSession(track);

  if (opts.position && opts.position > 1) {
    await whenMetadata(el);
    try {
      el.currentTime = Math.min(opts.position, Math.max(0, (el.duration || track.duration) - 0.25));
    } catch {
      /* seeking before metadata is a no-op */
    }
  }

  if (opts.autoplay !== false) {
    try {
      await el.play();
    } catch (err) {
      progressStore.update({ loading: false, playing: false });
      if ((err as Error).name === "NotAllowedError") {
        usePlayer.setState({ error: "Press play to start listening." });
      } else if ((err as Error).name !== "AbortError") {
        usePlayer.setState({ error: "This track could not be played. It may be unavailable." });
      }
    }
  } else {
    progressStore.update({ loading: false });
  }
}

function bindEvents() {
  if (bound) return;
  bound = true;
  const el = audioElement();

  el.addEventListener("timeupdate", () => {
    const duration = Number.isFinite(el.duration) ? el.duration : 0;
    let buffered = 0;
    if (el.buffered.length) buffered = el.buffered.end(el.buffered.length - 1);
    progressStore.update({ position: el.currentTime, duration, buffered });
    const state = usePlayer.getState();
    const track = state.queue[state.index];
    if (track && Date.now() - lastSaved > 5000) {
      lastSaved = Date.now();
      savePosition(track.id, el.currentTime);
    }
    if (Date.now() - lastPositionState > 900) {
      lastPositionState = Date.now();
      updatePositionState(el.currentTime, duration, el.playbackRate);
    }
  });

  el.addEventListener("progress", () => {
    if (el.buffered.length) {
      progressStore.update({ buffered: el.buffered.end(el.buffered.length - 1) });
    }
  });

  el.addEventListener("playing", () => {
    progressStore.update({ playing: true, loading: false });
    setMediaPlaybackState("playing");
  });
  el.addEventListener("play", () => {
    progressStore.update({ playing: true });
    setMediaPlaybackState("playing");
  });
  el.addEventListener("pause", () => {
    progressStore.update({ playing: false });
    setMediaPlaybackState("paused");
    const state = usePlayer.getState();
    const track = state.queue[state.index];
    if (track) savePosition(track.id, el.currentTime);
  });
  el.addEventListener("waiting", () => progressStore.update({ loading: true }));
  el.addEventListener("canplay", () => progressStore.update({ loading: false }));
  el.addEventListener("volumechange", () => {
    usePlayer.setState({ volume: el.volume, muted: el.muted });
  });
  el.addEventListener("ended", () => usePlayer.getState().next(true));
  el.addEventListener("error", () => {
    progressStore.update({ playing: false, loading: false });
    setMediaPlaybackState("paused");
    const track = usePlayer.getState().queue[usePlayer.getState().index];
    usePlayer.setState({
      error: track
        ? `“${track.title}” couldn't be played. The source may have removed it.`
        : "Playback failed. Check your connection.",
    });
  });

  if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
    const session = navigator.mediaSession;
    const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* Unsupported actions are ignored by the platform. */
      }
    };
    safe("play", () => usePlayer.getState().resume());
    safe("pause", () => usePlayer.getState().pause());
    safe("previoustrack", () => usePlayer.getState().prev());
    safe("nexttrack", () => usePlayer.getState().next());
    safe("stop", () => usePlayer.getState().pause());
    safe("seekbackward", (details) => {
      const el = audioElement();
      usePlayer.getState().seek(el.currentTime - (details.seekOffset ?? 10));
    });
    safe("seekforward", (details) => {
      const el = audioElement();
      usePlayer.getState().seek(el.currentTime + (details.seekOffset ?? 10));
    });
    safe("seekto", (details) => {
      if (typeof details.seekTime === "number") usePlayer.getState().seek(details.seekTime);
    });
  }
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: -1,
      repeat: "off",
      shuffle: false,
      volume: 0.85,
      muted: false,
      error: null,
      hydrated: false,

      playTracks: (tracks, startIndex = 0) => {
        const playable = tracks.filter((track) => track.streamable);
        if (!playable.length) {
          set({ error: "No playable tracks in this list." });
          return;
        }
        const start = Math.min(Math.max(startIndex, 0), playable.length - 1);
        set({ queue: playable, index: start, shuffle: false, error: null });
        shuffleBackup = null;
        useLibrary.getState().recordPlay(playable[start]);
        void loadTrack(playable[start], { autoplay: true });
      },

      playTrack: (track, context) => {
        const state = get();
        const current = state.queue[state.index];
        if (current?.id === track.id) {
          state.toggle();
          return;
        }
        if (context?.length) {
          const index = Math.max(0, context.findIndex((t) => t.id === track.id));
          state.playTracks(context, index);
          return;
        }
        if (!track.streamable) {
          set({ error: "This track isn't available to stream." });
          return;
        }
        const queue = [...state.queue];
        if (current && queue.length) {
          queue.splice(state.index + 1, 0, track);
          set({ queue, index: state.index + 1, error: null });
        } else {
          set({ queue: [track], index: 0, error: null });
        }
        useLibrary.getState().recordPlay(track);
        void loadTrack(track, { autoplay: true });
      },

      playAt: (index) => {
        const { queue } = get();
        if (index < 0 || index >= queue.length) return;
        const track = queue[index];
        set({ index, error: null });
        useLibrary.getState().recordPlay(track);
        void loadTrack(track, { autoplay: true });
      },

      toggle: () => {
        const { queue, index } = get();
        if (!queue[index]) return;
        if (progressStore.getSnapshot().playing) get().pause();
        else get().resume();
      },

      pause: () => {
        audioElement().pause();
      },

      resume: () => {
        const state = get();
        const track = state.queue[state.index];
        if (!track) return;
        const el = audioElement();
        if (!el.src) {
          const saved = readSavedPosition();
          void loadTrack(track, {
            position: saved?.id === track.id ? saved.position : 0,
            autoplay: true,
          });
          return;
        }
        el.play().catch((err) => {
          if ((err as Error).name !== "AbortError") {
            set({ error: "Playback was blocked. Tap play again." });
          }
        });
      },

      next: (auto = false) => {
        const { queue, index, repeat } = get();
        if (!queue.length) return;
        if (auto && repeat === "one") {
          const el = audioElement();
          el.currentTime = 0;
          void el.play().catch(() => undefined);
          return;
        }
        const nextIndex = index + 1;
        if (nextIndex < queue.length) {
          set({ index: nextIndex, error: null });
          useLibrary.getState().recordPlay(queue[nextIndex]);
          void loadTrack(queue[nextIndex], { autoplay: true });
          return;
        }
        if (repeat === "all") {
          set({ index: 0, error: null });
          useLibrary.getState().recordPlay(queue[0]);
          void loadTrack(queue[0], { autoplay: true });
          return;
        }
        const el = audioElement();
        el.pause();
        el.currentTime = 0;
        progressStore.update({ position: 0, playing: false });
        if (auto) set({ index: 0 });
      },

      prev: () => {
        const el = audioElement();
        const { queue, index } = get();
        if (!queue.length) return;
        if (el.currentTime > 3) {
          el.currentTime = 0;
          progressStore.update({ position: 0 });
          return;
        }
        const prevIndex = index - 1;
        if (prevIndex >= 0) {
          set({ index: prevIndex });
          useLibrary.getState().recordPlay(queue[prevIndex]);
          void loadTrack(queue[prevIndex], { autoplay: true });
        } else if (get().repeat === "all") {
          const last = queue.length - 1;
          set({ index: last });
          void loadTrack(queue[last], { autoplay: true });
        } else {
          el.currentTime = 0;
          progressStore.update({ position: 0 });
        }
      },

      seek: (seconds) => {
        const el = audioElement();
        const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : get().queue[get().index]?.duration || 0;
        const target = Math.min(Math.max(0, seconds), duration || seconds);
        try {
          el.currentTime = target;
          progressStore.update({ position: target });
          updatePositionState(target, duration, el.playbackRate);
        } catch {
          /* ignore seeks before metadata */
        }
      },

      cycleRepeat: () =>
        set((state) => ({
          repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off",
        })),

      toggleShuffle: () => {
        const state = get();
        if (!state.queue.length) return;
        if (state.shuffle) {
          const currentTrack = state.queue[state.index];
          const restored = shuffleBackup ?? state.queue;
          shuffleBackup = null;
          const index = Math.max(
            0,
            restored.findIndex((t) => t.id === currentTrack?.id),
          );
          set({ shuffle: false, queue: restored, index });
          return;
        }
        shuffleBackup = [...state.queue];
        const currentTrack = state.queue[state.index];
        const rest = state.queue.filter((t) => t.id !== currentTrack?.id);
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        const queue = currentTrack ? [currentTrack, ...rest] : rest;
        set({ shuffle: true, queue, index: 0 });
      },

      addToQueue: (track) => {
        const state = get();
        if (!state.queue.length) {
          state.playTracks([track], 0);
          return;
        }
        set({ queue: [...state.queue, track] });
      },

      addManyToQueue: (tracks) => {
        const state = get();
        if (!state.queue.length && tracks.length) {
          state.playTracks(tracks, 0);
          return;
        }
        set({ queue: [...state.queue, ...tracks] });
      },

      addNext: (track) => {
        const state = get();
        if (!state.queue.length) {
          state.playTracks([track], 0);
          return;
        }
        const queue = [...state.queue];
        queue.splice(state.index + 1, 0, track);
        set({ queue });
      },

      removeFromQueue: (target) => {
        const state = get();
        if (target < 0 || target >= state.queue.length) return;
        const queue = state.queue.filter((_, i) => i !== target);
        if (!queue.length) {
          state.clearQueue();
          return;
        }
        if (target === state.index) {
          const nextIndex = Math.min(target, queue.length - 1);
          set({ queue, index: nextIndex });
          void loadTrack(queue[nextIndex], { autoplay: progressStore.getSnapshot().playing });
          return;
        }
        set({ queue, index: target < state.index ? state.index - 1 : state.index });
      },

      moveInQueue: (from, to) => {
        const state = get();
        if (from === to || from < 0 || from >= state.queue.length || to < 0 || to >= state.queue.length) return;
        const queue = [...state.queue];
        const [moved] = queue.splice(from, 1);
        queue.splice(to, 0, moved);
        const currentId = state.queue[state.index]?.id;
        set({ queue, index: queue.findIndex((t) => t.id === currentId) });
      },

      clearQueue: () => {
        const el = audioElement();
        el.pause();
        el.removeAttribute("src");
        el.load();
        releaseSource();
        progressStore.reset();
        setMediaPlaybackState("none");
        shuffleBackup = null;
        set({ queue: [], index: -1, shuffle: false });
      },

      setVolume: (value) => {
        const el = audioElement();
        el.volume = Math.min(1, Math.max(0, value));
        el.muted = value === 0 ? true : false;
        set({ volume: el.volume, muted: el.muted });
      },

      toggleMute: () => {
        const el = audioElement();
        const state = get();
        if (state.muted || el.volume === 0) {
          el.muted = false;
          if (el.volume === 0) el.volume = 0.6;
          set({ muted: false, volume: el.volume });
        } else {
          el.muted = true;
          set({ muted: true });
        }
      },

      hydrate: () => {
        if (get().hydrated) return;
        bindEvents();
        set({ hydrated: true });
        const el = audioElement();
        el.volume = get().muted ? 0 : get().volume;
        const track = get().queue[get().index];
        if (!track) return;
        const saved = readSavedPosition();
        progressStore.update({ duration: track.duration || 0, position: saved?.id === track.id ? saved.position : 0 });
        if (saved?.id === track.id) {
          void loadTrack(track, { position: saved.position, autoplay: false });
        } else {
          void loadTrack(track, { autoplay: false });
        }
      },

      dismissError: () => set({ error: null }),
    }),
    {
      name: "melo-player",
      version: 1,
      partialize: (state) => ({
        queue: state.queue,
        index: state.index,
        repeat: state.repeat,
        shuffle: state.shuffle,
        volume: state.volume,
        muted: state.muted,
      }),
    },
  ),
);

export const currentTrack = (state: PlayerState): Track | null => state.queue[state.index] ?? null;
