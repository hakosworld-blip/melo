import { create } from 'zustand';
import type { Track } from './types';

/** Cross-screen UI state: which track is waiting to be filed into a playlist. */

interface UiState {
  pendingTrack: Track | null;
  lyricsTrack: Track | null;
  openAddToPlaylist: (track: Track) => void;
  closeAddToPlaylist: () => void;
  openLyrics: (track: Track) => void;
  closeLyrics: () => void;
}

export const useUi = create<UiState>((set) => ({
  pendingTrack: null,
  lyricsTrack: null,
  openAddToPlaylist: (track) => set({ pendingTrack: track }),
  closeAddToPlaylist: () => set({ pendingTrack: null }),
  openLyrics: (track) => set({ lyricsTrack: track }),
  closeLyrics: () => set({ lyricsTrack: null }),
}));
