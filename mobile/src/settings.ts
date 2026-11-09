import { create } from 'zustand';
import { loadJson, saveJsonSoon } from './storage';

/**
 * The only setting that matters for now: the address of a melo server on this
 * network. It is optional — Spotify import, search and playback all work
 * without it — but YouTube playlists can only be read (and played) through a
 * server that has yt-dlp, so it is where that lives.
 */

const FILE = 'melo-settings';

interface SettingsState {
  ready: boolean;
  serverUrl: string;
  setServerUrl: (value: string) => void;
}

export function normaliseServerUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export const useSettings = create<SettingsState>((set) => ({
  ready: false,
  serverUrl: '',
  setServerUrl: (value) => set({ serverUrl: normaliseServerUrl(value) }),
}));

/** Non-hook read, for the player and API layer. */
export function getServerUrl() {
  return useSettings.getState().serverUrl;
}

export async function hydrateSettings() {
  const saved = await loadJson<{ serverUrl?: string }>(FILE);
  useSettings.setState({ serverUrl: normaliseServerUrl(saved?.serverUrl ?? ''), ready: true });
}

useSettings.subscribe((state) => {
  if (!state.ready) return;
  saveJsonSoon(FILE, { serverUrl: state.serverUrl });
});
