import { create } from 'zustand';
import type { Track } from './types';

/** Cross-screen UI state: which track is waiting to be filed into a playlist. */

interface UiState {
  pendingTrack: Track | null;
  openAddToPlaylist: (track: Track) => void;
  closeAddToPlaylist: () => void;
}

export const useUi = create<UiState>((set) => ({
  pendingTrack: null,
  openAddToPlaylist: (track) => set({ pendingTrack: track }),
  closeAddToPlaylist: () => set({ pendingTrack: null }),
}));
