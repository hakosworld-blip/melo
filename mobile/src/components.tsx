import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Music2, Pause, Play, Plus, SkipForward } from 'lucide-react-native';
import { useAudioPlaylistStatus } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import { playlist, togglePlayback, skipNext, usePlayer, playTrack, addToQueue } from './player';
import type { Track } from './types';

export const colors = {
  bg: '#11100F',
  surface: '#1B1A18',
  surfaceRaised: '#25231F',
  line: '#2B2925',
  text: '#F4F1EC',
  muted: '#A8A29A',
  accent: '#F5C46B',
  danger: '#FF8A7A',
};

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Artwork({ source, size = 56, rounded = 12 }: { source?: string; size?: number; rounded?: number }) {
  if (source) {
    return <Image source={{ uri: source }} style={[styles.artwork, { width: size, height: size, borderRadius: rounded }]} resizeMode="cover" />;
  }
  return (
    <View style={[styles.artworkFallback, { width: size, height: size, borderRadius: rounded }]}>
      <Music2 size={Math.round(size * 0.34)} color={colors.muted} />
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

export function TrackRow({ track, context, index }: { track: Track; context?: Track[]; index?: number }) {
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const isCurrent = queue[status.currentIndex]?.id === track.id;
  return (
    <View style={styles.trackRow}>
      <Pressable style={styles.trackMain} onPress={() => playTrack(track, context)} accessibilityRole="button" accessibilityLabel={`Play ${track.title}`}>
        <Artwork source={track.artworkSmall || track.artwork} size={52} />
        <View style={styles.trackText}>
          <Text style={[styles.trackTitle, isCurrent && styles.currentTrack]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.trackSubtitle} numberOfLines={1}>
            {track.artist}
            {track.album ? ` · ${track.album}` : ''}
          </Text>
        </View>
      </Pressable>
      <Text style={styles.duration}>{formatTime(track.duration)}</Text>
      <Pressable style={styles.iconButton} onPress={() => addToQueue(track)} accessibilityRole="button" accessibilityLabel={`Add ${track.title} to queue`}>
        <Plus size={18} color={colors.muted} />
      </Pressable>
      {index !== undefined ? <Text style={styles.index}>{index + 1}</Text> : null}
    </View>
  );
}

export function MiniPlayer() {
  const navigation = useNavigation<any>();
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const track = queue[status.currentIndex];
  if (!track) return null;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  return (
    <Pressable style={styles.miniPlayer} onPress={() => navigation.navigate('NowPlaying')} accessibilityRole="button" accessibilityLabel={`Open ${track.title}`}>
      <Artwork source={track.artworkSmall || track.artwork} size={44} rounded={10} />
      <View style={styles.miniText}>
        <Text style={styles.miniTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.miniSubtitle} numberOfLines={1}>
          {track.artist}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>
      <Pressable style={styles.miniPlay} onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Play'}>
        {status.playing ? <Pause size={20} color={colors.bg} fill={colors.bg} /> : <Play size={20} color={colors.bg} fill={colors.bg} />}
      </Pressable>
      <Pressable style={styles.iconButton} onPress={skipNext} accessibilityRole="button" accessibilityLabel="Next track">
        <SkipForward size={20} color={colors.text} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  artwork: { backgroundColor: colors.surfaceRaised },
  artworkFallback: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  sectionSubtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  errorBanner: { backgroundColor: '#3A211D', borderColor: '#5A332E', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: colors.danger, fontSize: 13 },
  emptyState: { padding: 28, alignItems: 'center' },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  trackMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trackText: { flex: 1, minWidth: 0 },
  trackTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  currentTrack: { color: colors.accent },
  trackSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  duration: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  index: { color: colors.muted, fontSize: 12, width: 18, textAlign: 'right' },
  miniPlayer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#242220F2',
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  miniText: { flex: 1, minWidth: 0 },
  miniTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  miniSubtitle: { color: colors.muted, fontSize: 12, marginTop: 1 },
  progressTrack: { height: 2, backgroundColor: colors.line, borderRadius: 1, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 2, backgroundColor: colors.accent },
  miniPlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
});
