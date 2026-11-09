import { create } from 'zustand';
import { loadJson, saveJsonSoon } from './storage';
import type { Track } from './types';

/**
 * Playlists on the phone, kept in a JSON file in the app's private storage.
 * There is no account and no sync, so a playlist lives exactly as long as the
 * app is installed — the same promise the web build makes.
 */

export interface LocalPlaylist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

const FILE = 'melo-playlists';

interface LibraryState {
  ready: boolean;
  playlists: LocalPlaylist[];
  createPlaylist: (name: string, tracks?: Track[]) => string;
  addTracks: (playlistId: string, tracks: Track[]) => number;
  addTrack: (playlistId: string, track: Track) => boolean;
  removeTrack: (playlistId: string, trackId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanName(name: string) {
  return name.trim().slice(0, 80) || 'Untitled playlist';
}

export const useLibrary = create<LibraryState>((set, get) => ({
  ready: false,
  playlists: [],

  createPlaylist(name, tracks = []) {
    const playlist: LocalPlaylist = {
      id: newId(),
      name: cleanName(name),
      tracks,
      createdAt: Date.now(),
    };
    set({ playlists: [...get().playlists, playlist] });
    return playlist.id;
  },

  addTracks(playlistId, tracks) {
    const playlist = get().playlists.find((p) => p.id === playlistId);
    if (!playlist) return 0;
    const existing = new Set(playlist.tracks.map((t) => t.id));
    const added = tracks.filter((track) => !existing.has(track.id));
    if (!added.length) return 0;
    set({
      playlists: get().playlists.map((p) => (p.id === playlistId ? { ...p, tracks: [...p.tracks, ...added] } : p)),
    });
    return added.length;
  },

  addTrack(playlistId, track) {
    const playlist = get().playlists.find((p) => p.id === playlistId);
    if (!playlist) return false;
    if (playlist.tracks.some((t) => t.id === track.id)) return false;
    set({
      playlists: get().playlists.map((p) => (p.id === playlistId ? { ...p, tracks: [...p.tracks, track] } : p)),
    });
    return true;
  },

  removeTrack(playlistId, trackId) {
    set({
      playlists: get().playlists.map((p) =>
        p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p,
      ),
    });
  },

  renamePlaylist(playlistId, name) {
    set({
      playlists: get().playlists.map((p) => (p.id === playlistId ? { ...p, name: cleanName(name) } : p)),
    });
  },

  deletePlaylist(playlistId) {
    set({ playlists: get().playlists.filter((p) => p.id !== playlistId) });
  },
}));

export function getPlaylist(id: string) {
  return useLibrary.getState().playlists.find((p) => p.id === id);
}

/** Re-importing under the same name tops up the existing playlist instead of duplicating it. */
export function findPlaylistByName(name: string) {
  const wanted = name.trim().toLowerCase();
  return useLibrary.getState().playlists.find((p) => p.name.trim().toLowerCase() === wanted);
}

export async function hydrateLibrary() {
  const saved = await loadJson<LocalPlaylist[]>(FILE);
  const playlists = Array.isArray(saved)
    ? saved.filter((p) => p && typeof p.id === 'string' && Array.isArray(p.tracks))
    : [];
  useLibrary.setState({ playlists, ready: true });
}

useLibrary.subscribe((state) => {
  if (!state.ready) return;
  saveJsonSoon(FILE, state.playlists);
});
