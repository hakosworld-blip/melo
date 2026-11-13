"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";
export type Density = "compact" | "comfortable" | "spacious";
export type BackgroundType = "color" | "gradient" | "image" | "artwork";
export type GlassStyle = "classic" | "liquid";
export type SectionKey = "app" | "home" | "library" | "nowPlaying";

export interface BackgroundConfig {
  type: BackgroundType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  /** IndexedDB key for a user-uploaded image. */
  imageKey?: string;
  /** 0–100 dark scrim over the background, for readability. */
  overlay: number;
  blur: number;
  brightness: number;
  saturation: number;
}

export interface Settings {
  theme: ThemeMode;
  accent: string;
  density: Density;
  radius: number;
  font: "sans" | "serif" | "mono";
  glass: GlassStyle;
  animations: "full" | "reduced";
  motion: "slide" | "fade" | "scale";
  backgrounds: Record<SectionKey, BackgroundConfig>;
  nowPlaying: {
    blurArtwork: boolean;
    artworkBlur: number;
    artworkStyle: "rounded" | "circle" | "square";
    controlsStyle: "filled" | "outline" | "minimal";
    showRemaining: boolean;
    glow: boolean;
  };
  lyrics: {
    fontSize: number;
    align: "center" | "left";
    highlight: "fill" | "glow" | "underline";
    autoScroll: boolean;
  };
}

export const ACCENTS = [
  { name: "Ink", value: "ink" },
  { name: "Sand", value: "#E6BE86" },
  { name: "Coral", value: "#F08C7E" },
  { name: "Mint", value: "#7FDCC0" },
  { name: "Sky", value: "#8FBBFF" },
  { name: "Lilac", value: "#C2A6FF" },
  { name: "Rose", value: "#F2A6C9" },
  { name: "Lime", value: "#D5E877" },
  { name: "Paper", value: "#EDEBE7" },
];

const plainBackground = (color: string): BackgroundConfig => ({
  type: "color",
  color,
  gradientFrom: "#1a1a1f",
  gradientTo: "#0a0a0c",
  gradientAngle: 160,
  overlay: 0,
  blur: 0,
  brightness: 1,
  saturation: 1,
});

const defaultSettings: Settings = {
  theme: "dark",
  accent: "ink",
  density: "comfortable",
  radius: 10,
  font: "sans",
  glass: "classic",
  animations: "full",
  motion: "slide",
  backgrounds: {
    app: plainBackground("#0A0A0B"),
    home: plainBackground("#0A0A0B"),
    library: plainBackground("#0A0A0B"),
    nowPlaying: {
      ...plainBackground("#0A0A0B"),
      type: "artwork",
      overlay: 55,
      blur: 60,
      brightness: 0.85,
      saturation: 1.15,
    },
  },
  nowPlaying: {
    blurArtwork: true,
    artworkBlur: 60,
    artworkStyle: "rounded",
    controlsStyle: "filled",
    showRemaining: false,
    glow: true,
  },
  lyrics: {
    fontSize: 26,
    align: "left",
    highlight: "fill",
    autoScroll: true,
  },
};

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
  setBackground: (section: SectionKey, patch: Partial<BackgroundConfig>) => void;
  nowPlayingChange: (patch: Partial<Settings["nowPlaying"]>) => void;
  lyricsChange: (patch: Partial<Settings["lyrics"]>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      update: (patch) => set((state) => ({ ...state, ...patch })),
      setBackground: (section, patch) =>
        set((state) => ({
          backgrounds: {
            ...state.backgrounds,
            [section]: { ...state.backgrounds[section], ...patch },
          },
        })),
      nowPlayingChange: (patch) =>
        set((state) => ({ nowPlaying: { ...state.nowPlaying, ...patch } })),
      lyricsChange: (patch) => set((state) => ({ lyrics: { ...state.lyrics, ...patch } })),
      reset: () => set({ ...defaultSettings }),
    }),
    {
      name: "melo-settings",
      version: 6,
      /** v3 is the dark listening room; v5 drops the source switch; v6 adds liquid glass. */
      migrate: (persisted, version) => {
        const state = persisted as SettingsState & { provider?: unknown; glass?: GlassStyle };
        if (version < 2) return { ...state, accent: "ink", radius: 10, theme: "dark" };
        if (version < 3) return { ...state, theme: "dark", radius: 10 };
        delete state.provider;
        if (version < 6 || !state.glass) state.glass = "classic";
        return state;
      },
    },
  ),
);

export function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
