import { create } from 'zustand';
import { loadJson, saveJsonSoon } from './storage';

/**
 * The only setting that matters for now: the address of a melo server on this
 * network. It is optional — Spotify import, search and playback all work
 * without it — but YouTube playlists can only be read (and played) through a
 * server that has yt-dlp, so it is where that lives.
 */

const FILE = 'melo-settings';

export type GlassStyle = 'classic' | 'liquid';
/** Android only: system bars stay visible (edge to edge) or hide entirely. */
export type DisplayMode = 'edge' | 'fullscreen';

interface SettingsState {
  ready: boolean;
  serverUrl: string;
  /** Classic is the flat frosted look; liquid adds animated specular glass. */
  glassStyle: GlassStyle;
  displayMode: DisplayMode;
  setServerUrl: (value: string) => void;
  setGlassStyle: (value: GlassStyle) => void;
  setDisplayMode: (value: DisplayMode) => void;
}

export function normaliseServerUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export const useSettings = create<SettingsState>((set) => ({
  ready: false,
  serverUrl: '',
  glassStyle: 'classic',
  displayMode: 'edge',
  setServerUrl: (value) => set({ serverUrl: normaliseServerUrl(value) }),
  setGlassStyle: (value) => set({ glassStyle: value }),
  setDisplayMode: (value) => set({ displayMode: value }),
}));

/** Non-hook read, for the player and API layer. */
export function getServerUrl() {
  return useSettings.getState().serverUrl;
}

export async function hydrateSettings() {
  const saved = await loadJson<{ serverUrl?: string; glassStyle?: GlassStyle; displayMode?: DisplayMode }>(FILE);
  useSettings.setState({
    serverUrl: normaliseServerUrl(saved?.serverUrl ?? ''),
    glassStyle: saved?.glassStyle === 'liquid' ? 'liquid' : 'classic',
    displayMode: saved?.displayMode === 'fullscreen' ? 'fullscreen' : 'edge',
    ready: true,
  });
}

useSettings.subscribe((state) => {
  if (!state.ready) return;
  saveJsonSoon(FILE, { serverUrl: state.serverUrl, glassStyle: state.glassStyle, displayMode: state.displayMode });
});
