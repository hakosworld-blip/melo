"use client";

import { create } from "zustand";
import type { Track } from "@/lib/types";

export type SheetState =
  | { type: "queue" }
  | { type: "lyrics"; track?: Track }
  | { type: "addToPlaylist"; track: Track }
  | { type: "trackMenu"; track: Track }
  | { type: "createPlaylist"; track?: Track }
  | { type: "editPlaylist"; playlistId: string }
  | {
      type: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      destructive?: boolean;
      onConfirm: () => void | Promise<void>;
    }
  | null;

interface UiState {
  nowPlayingOpen: boolean;
  sheet: SheetState;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  openSheet: (sheet: Exclude<SheetState, null>) => void;
  closeSheet: () => void;
}

export const useUi = create<UiState>((set) => ({
  nowPlayingOpen: false,
  sheet: null,
  openNowPlaying: () => set({ nowPlayingOpen: true, sheet: null }),
  closeNowPlaying: () => set({ nowPlayingOpen: false, sheet: null }),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
}));
