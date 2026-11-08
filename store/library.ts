"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArtistSummary, LocalPlaylist, Track } from "@/lib/types";

interface PlayStat {
  count: number;
  lastPlayed: number;
}

interface LibraryState {
  playlists: LocalPlaylist[];
  followedArtists: ArtistSummary[];
  recent: Track[];
  playStats: Record<string, PlayStat>;
  createPlaylist: (name: string, tracks?: Track[]) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  setPlaylistArtwork: (id: string, artworkKey?: string, artworkUrl?: string) => void;
  addTracks: (playlistId: string, tracks: Track[]) => number;
  removeTrack: (playlistId: string, trackId: string) => void;
  reorder: (playlistId: string, from: number, to: number) => void;
  recordPlay: (track: Track) => void;
  forgetTrack: (trackId: string) => void;
  toggleFollow: (artist: ArtistSummary) => boolean;
  isFollowing: (artistId: string) => boolean;
  topTracks: (limit?: number) => { track: Track; count: number }[];
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      playlists: [],
      followedArtists: [],
      recent: [],
      playStats: {},

      createPlaylist: (name, tracks = []) => {
        const now = Date.now();
        const id = newId();
        const playlist: LocalPlaylist = {
          id,
          name: name.trim() || "New playlist",
          tracks,
          artworkUrl: tracks.find((t) => t.artwork)?.artwork,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ playlists: [playlist, ...state.playlists] }));
        return id;
      },

      renamePlaylist: (id, name) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p,
          ),
        })),

      deletePlaylist: (id) =>
        set((state) => ({ playlists: state.playlists.filter((p) => p.id !== id) })),

      setPlaylistArtwork: (id, artworkKey, artworkUrl) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, artworkKey, artworkUrl: artworkUrl ?? p.artworkUrl, updatedAt: Date.now() } : p,
          ),
        })),

      addTracks: (playlistId, tracks) => {
        const playlist = get().playlists.find((p) => p.id === playlistId);
        if (!playlist) return 0;
        const existing = new Set(playlist.tracks.map((t) => t.id));
        const fresh = tracks.filter((t) => !existing.has(t.id));
        if (!fresh.length) return 0;
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  tracks: [...p.tracks, ...fresh],
                  artworkUrl: p.artworkUrl || fresh.find((t) => t.artwork)?.artwork,
                  updatedAt: Date.now(),
                }
              : p,
          ),
        }));
        return fresh.length;
      },

      removeTrack: (playlistId, trackId) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId), updatedAt: Date.now() }
              : p,
          ),
        })),

      reorder: (playlistId, from, to) =>
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            const tracks = [...p.tracks];
            if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length) return p;
            const [moved] = tracks.splice(from, 1);
            tracks.splice(to, 0, moved);
            return { ...p, tracks, updatedAt: Date.now() };
          }),
        })),

      recordPlay: (track) =>
        set((state) => {
          const stats = { ...state.playStats };
          const prev = stats[track.id];
          stats[track.id] = { count: (prev?.count ?? 0) + 1, lastPlayed: Date.now() };
          const recent = [track, ...state.recent.filter((t) => t.id !== track.id)].slice(0, 60);
          return { playStats: stats, recent };
        }),

      forgetTrack: (trackId) =>
        set((state) => {
          const stats = { ...state.playStats };
          delete stats[trackId];
          return { playStats: stats, recent: state.recent.filter((t) => t.id !== trackId) };
        }),

      toggleFollow: (artist) => {
        const following = get().isFollowing(artist.id);
        set((state) => ({
          followedArtists: following
            ? state.followedArtists.filter((a) => a.id !== artist.id)
            : [artist, ...state.followedArtists],
        }));
        return !following;
      },

      isFollowing: (artistId) => get().followedArtists.some((a) => a.id === artistId),

      topTracks: (limit = 10) =>
        Object.entries(get().playStats)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, limit)
          .map(([id, stat]) => ({
            track: get().recent.find((t) => t.id === id) as Track,
            count: stat.count,
          }))
          .filter((entry) => Boolean(entry.track)),
    }),
    { name: "melo-library", version: 1 },
  ),
);
