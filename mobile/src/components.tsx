import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ListPlus, Music2, Pause, Play, Plus, SkipForward, X } from 'lucide-react-native';
import { useAudioPlaylistStatus } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import { playlist, togglePlayback, skipNext, usePlayer, playTrack, addToQueue } from './player';
import { useLibrary } from './library';
import { useUi } from './ui';
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

export function TrackRow({
  track,
  context,
  index,
  onRemove,
}: {
  track: Track;
  context?: Track[];
  index?: number;
  onRemove?: () => void;
}) {
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
      <Pressable
        style={styles.iconButton}
        onPress={() => useUi.getState().openAddToPlaylist(track)}
        accessibilityRole="button"
        accessibilityLabel={`Add ${track.title} to a playlist`}
      >
        <ListPlus size={18} color={colors.muted} />
      </Pressable>
      {onRemove ? (
        <Pressable style={styles.iconButton} onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${track.title} from this playlist`}>
          <X size={18} color={colors.muted} />
        </Pressable>
      ) : null}
      {index !== undefined ? <Text style={styles.index}>{index + 1}</Text> : null}
    </View>
  );
}

/** One field, one action: naming or renaming a playlist. */
export function PromptModal({
  visible,
  title,
  placeholder,
  initialValue = '',
  submitLabel = 'Save',
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <View style={styles.dialogActions}>
            <Pressable style={styles.secondaryButton} onPress={onClose} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, !value.trim() && styles.buttonDisabled]}
              onPress={submit}
              disabled={!value.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** The "file this song somewhere" sheet, reachable from every track row. */
export function AddToPlaylistSheet() {
  const pendingTrack = useUi((s) => s.pendingTrack);
  const close = useUi((s) => s.closeAddToPlaylist);
  const playlists = useLibrary((s) => s.playlists);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingTrack) {
      setCreating(false);
      setName('');
      setAdded(null);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pendingTrack]);

  const file = (playlistId: string, playlistName: string) => {
    if (!pendingTrack) return;
    useLibrary.getState().addTrack(playlistId, pendingTrack);
    setAdded(playlistName);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => close(), 900);
  };

  const createAndFile = () => {
    const trimmed = name.trim();
    if (!trimmed || !pendingTrack) return;
    const id = useLibrary.getState().createPlaylist(trimmed, [pendingTrack]);
    setAdded(trimmed);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => close(), 900);
  };

  return (
    <Modal visible={Boolean(pendingTrack)} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.sheetBackdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.dialogTitle}>Add to playlist</Text>
          {pendingTrack ? (
            <Text style={styles.sheetSubtitle} numberOfLines={1}>
              {pendingTrack.title} · {pendingTrack.artist}
            </Text>
          ) : null}
          {added ? <Text style={styles.added}>Added to “{added}”</Text> : null}

          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
            {playlists.length === 0 && !creating ? (
              <Text style={styles.sheetEmpty}>No playlists yet — create the first one below.</Text>
            ) : null}
            {playlists.map((item) => {
              const already = Boolean(pendingTrack && item.tracks.some((t) => t.id === pendingTrack.id));
              return (
                <Pressable
                  key={item.id}
                  style={styles.sheetRow}
                  onPress={() => file(item.id, item.name)}
                  disabled={already}
                  accessibilityRole="button"
                  accessibilityLabel={`Add to ${item.name}`}
                >
                  <Artwork source={item.tracks[0]?.artworkSmall || item.tracks[0]?.artwork} size={40} rounded={10} />
                  <View style={styles.sheetRowText}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.trackSubtitle}>
                      {item.tracks.length} {item.tracks.length === 1 ? 'song' : 'songs'}
                      {already ? ' · already there' : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {creating ? (
            <View style={styles.createRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Playlist name"
                placeholderTextColor={colors.muted}
                style={styles.createInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createAndFile}
              />
              <Pressable
                style={[styles.primaryButton, !name.trim() && styles.buttonDisabled]}
                onPress={createAndFile}
                disabled={!name.trim()}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Create</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.secondaryButton} onPress={() => setCreating(true)} accessibilityRole="button">
              <ListPlus size={16} color={colors.text} />
              <Text style={styles.secondaryButtonText}>New playlist</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14, color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surfaceRaised, borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  primaryButtonText: { color: colors.bg, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: '#000000AA', alignItems: 'center', justifyContent: 'center', padding: 22 },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: colors.surfaceRaised, borderRadius: 20, borderColor: colors.line, borderWidth: 1, padding: 18, gap: 12 },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 2 },
  buttonDisabled: { opacity: 0.45 },
  sheetBackdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderColor: colors.line, borderWidth: 1, padding: 18, paddingBottom: 26, gap: 8, maxHeight: '76%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 8 },
  sheetSubtitle: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  sheetList: { marginTop: 4 },
  sheetEmpty: { color: colors.muted, fontSize: 13, paddingVertical: 10 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  sheetRowText: { flex: 1, minWidth: 0 },
  added: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  createInput: { flex: 1, backgroundColor: colors.surfaceRaised, borderColor: colors.line, borderWidth: 1, borderRadius: 12, color: colors.text, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10 },
});
