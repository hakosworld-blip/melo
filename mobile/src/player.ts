import { Platform } from 'react-native';
import { create } from 'zustand';
import { createAudioPlaylist, requestNotificationPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { canStream, streamUrl } from './api';
import type { Track } from './types';

export const playlist = createAudioPlaylist({ sources: [], updateInterval: 500, loop: 'none' });

export type MobilePlaylist = ReturnType<typeof createAudioPlaylist>;

interface PlayerState {
  queue: Track[];
  error: string | null;
  setQueue: (tracks: Track[]) => void;
  setError: (message: string | null) => void;
  dismissError: () => void;
}

export const usePlayer = create<PlayerState>((set) => ({
  queue: [],
  error: null,
  setQueue: (tracks) => set({ queue: tracks }),
  setError: (message) => set({ error: message }),
  dismissError: () => set({ error: null }),
}));

let initialized = false;

export async function initPlayer() {
  if (initialized) return;
  initialized = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
  } catch {
    /* Audio session setup is best-effort on unsupported devices. */
  }
  if (Platform.OS === 'android') {
    try {
      await requestNotificationPermissionsAsync();
    } catch {
      /* Media notifications can still work when permission is granted later. */
    }
  }
}

function playable(tracks: Track[]) {
  return tracks.filter(canStream);
}

/** Explains the one case where a song exists but this device can't play it. */
function unavailableMessage(tracks: Track[]) {
  return tracks.some((track) => track.provider === 'youtube')
    ? 'YouTube songs play through a melo server. Add your server address in Settings.'
    : 'No playable tracks in this list.';
}

function updateLockScreen(track: Track) {
  try {
    playlist.setActiveForLockScreen(true, {
      title: track.title,
      artist: track.artist,
      albumTitle: track.album || 'melo',
      artworkUrl: track.artwork,
    });
  } catch {
    /* Lock-screen metadata is best-effort. */
  }
}

export function playTracks(tracks: Track[], startIndex = 0) {
  const items = playable(tracks);
  if (!items.length) {
    usePlayer.getState().setError(unavailableMessage(tracks));
    return;
  }
  const index = Math.min(Math.max(startIndex, 0), items.length - 1);
  const skipped = tracks.filter((track) => !canStream(track)).length;
  usePlayer.getState().setQueue(items);
  usePlayer.getState().setError(null);
  if (skipped > 0) {
    usePlayer
      .getState()
      .setError(
        `${skipped} ${skipped === 1 ? 'song is' : 'songs are'} from YouTube and need a melo server to play. The rest of the playlist is playing.`,
      );
  }
  playlist.clear();
  items.forEach((track) => playlist.add(streamUrl(track)));
  playlist.skipTo(index);
  updateLockScreen(items[index]);
  playlist.play();
}

export function playTrack(track: Track, context?: Track[]) {
  if (context?.length) {
    const index = Math.max(0, context.findIndex((t) => t.id === track.id));
    playTracks(context, index);
    return;
  }
  if (!canStream(track)) {
    usePlayer.getState().setError(unavailableMessage([track]));
    return;
  }
  playTracks([track], 0);
}

export function togglePlayback() {
  if (playlist.playing) playlist.pause();
  else playlist.play();
}

export function skipNext() {
  playlist.next();
}

export function skipPrevious() {
  playlist.previous();
}

export function seekTo(seconds: number) {
  void playlist.seekTo(seconds);
}

export function seekBy(offset: number) {
  const target = Math.max(0, playlist.currentTime + offset);
  void playlist.seekTo(target);
}

export function addToQueue(track: Track) {
  if (!canStream(track)) {
    usePlayer.getState().setError(unavailableMessage([track]));
    return;
  }
  const queue = [...usePlayer.getState().queue, track];
  usePlayer.getState().setQueue(queue);
  playlist.add(streamUrl(track));
}
