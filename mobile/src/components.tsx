import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { ListPlus, Music2, Pause, Play, Plus, SkipForward, X } from 'lucide-react-native';
import { useAudioPlaylistStatus } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import { playlist, togglePlayback, skipNext, usePlayer, playTrack, addToQueue } from './player';
import { useLibrary } from './library';
import { useUi } from './ui';
import type { Track } from './types';

/**
 * A listening room, not a document: near-black canvas, raised charcoal
 * surfaces, hairline rules and one white accent. Display type is the same tight
 * grotesque as the web build, and colour only ever comes from artwork.
 */

export const colors = {
  bg: '#0A0A0B',
  surface: '#131315',
  surfaceRaised: '#1C1C1F',
  line: '#27272B',
  text: '#F4F4F5',
  muted: '#9C9CA4',
  accent: '#FFFFFF',
  accentInk: '#0A0A0B',
  danger: '#FF8A86',
  paleRed: '#2A1516',
  paleBlue: '#101B26',
  paleGreen: '#10201A',
  paleYellow: '#241D0F',
  stage: '#121114',
  glass: 'rgba(255,255,255,0.055)',
  glassStrong: 'rgba(22,22,28,0.9)',
  glassLine: 'rgba(255,255,255,0.13)',
  glassHighlight: 'rgba(255,255,255,0.10)',
};

export const fonts = {
  serif: 'Manrope_700Bold',
  serifSemi: 'Manrope_700Bold',
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansBold: 'Manrope_700Bold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
};

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * The room's light.
 *
 * Glass only reads as glass when something sits behind it. Two soft colour
 * pools per hue are stacked (large + faint, then smaller + slightly brighter)
 * so they fade like blurred light without pulling in a native blur module.
 * Decorative only.
 */
export function AmbientBackdrop() {
  return (
    <View pointerEvents="none" style={styles.ambient}>
      <View style={[styles.orb, styles.orbOuter, { top: -240, left: -200, backgroundColor: '#4F7DFF' }]} />
      <View style={[styles.orb, styles.orbInner, { top: -160, left: -120, backgroundColor: '#4F7DFF' }]} />
      <View style={[styles.orb, styles.orbOuter, { top: 80, right: -240, backgroundColor: '#A855F7' }]} />
      <View style={[styles.orb, styles.orbInner, { top: 150, right: -160, backgroundColor: '#A855F7' }]} />
      <View style={[styles.orb, styles.orbOuter, { bottom: -320, left: 10, backgroundColor: '#1FA97A' }]} />
      <View style={[styles.orb, styles.orbInner, { bottom: -240, left: 70, backgroundColor: '#1FA97A' }]} />
    </View>
  );
}

/** The OS setting wins: motion is skipped, not just shortened, when it's off. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduce(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

/** Sections rise in, one after another, instead of snapping into place. */
export function RiseIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(16)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      shift.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, [opacity, shift, delay, reduce]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY: shift }] }]}>{children}</Animated.View>;
}

/**
 * Press feedback: a short scale-down on touch and a slower release. Uses the
 * native driver, so it never waits on the JS thread to feel responsive.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ style, children, disabled, ...rest }: PressableProps & { children?: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();

  const animate = (toValue: number, duration: number) => {
    Animated.timing(scale, { toValue, duration, useNativeDriver: true }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        if (!reduce && !disabled) animate(0.955, 90);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduce) animate(1, 200);
        rest.onPressOut?.(event);
      }}
      style={[style as StyleProp<ViewStyle>, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Artwork({
  source,
  size = 56,
  rounded = 8,
  blurred = false,
}: {
  source?: string;
  size?: number;
  rounded?: number;
  blurred?: boolean;
}) {
  if (source) {
    return (
      <Image
        source={{ uri: source }}
        style={[styles.artwork, { width: size, height: size, borderRadius: rounded }]}
        resizeMode="cover"
        blurRadius={blurred ? 40 : 0}
      />
    );
  }
  return (
    <View style={[styles.artworkFallback, { width: size, height: size, borderRadius: rounded }]}>
      <Music2 size={Math.round(size * 0.3)} color={colors.muted} />
    </View>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
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

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{children}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, variant === 'primary' ? styles.buttonPrimary : styles.buttonGhost, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={variant === 'primary' ? styles.buttonPrimaryText : styles.buttonGhostText}>{label}</Text>
    </Pressable>
  );
}

export function TrackRow({
  track,
  context,
  index,
  onRemove,
  compact = false,
}: {
  track: Track;
  context?: Track[];
  index?: number;
  onRemove?: () => void;
  /** Queue rows only need transport: no add-to-queue or playlist buttons. */
  compact?: boolean;
}) {
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const isCurrent = queue[status.currentIndex]?.id === track.id;
  return (
    <RiseIn delay={((index ?? 0) % 10) * 35}>
    <View style={styles.trackRow}>
      <Pressable
        style={styles.trackMain}
        onPress={() => playTrack(track, context)}
        onLongPress={() => useUi.getState().openLyrics(track)}
        delayLongPress={320}
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title}. Long press for lyrics`}
      >
        <Artwork source={track.artworkSmall || track.artwork} size={48} />
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
      {compact ? null : (
        <>
          <Pressable
            style={styles.iconButton}
            onPress={() => addToQueue(track)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${track.title} to queue`}
          >
            <Plus size={17} color={colors.muted} />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={() => useUi.getState().openAddToPlaylist(track)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${track.title} to a playlist`}
          >
            <ListPlus size={17} color={colors.muted} />
          </Pressable>
        </>
      )}
      {onRemove ? (
        <Pressable
          style={styles.iconButton}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${track.title} from this playlist`}
        >
          <X size={17} color={colors.muted} />
        </Pressable>
      ) : null}
      {index !== undefined ? <Text style={styles.index}>{index + 1}</Text> : null}
    </View>
    </RiseIn>
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
          <Text style={styles.label}>Playlist</Text>
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
            <Pressable style={styles.buttonGhost} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonPrimary, !value.trim() && styles.disabled]}
              onPress={submit}
              disabled={!value.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.buttonPrimaryText}>{submitLabel}</Text>
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
    useLibrary.getState().createPlaylist(trimmed, [pendingTrack]);
    setAdded(trimmed);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => close(), 900);
  };

  return (
    <Modal visible={Boolean(pendingTrack)} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.sheetBackdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.label}>Add to playlist</Text>
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
                  <Artwork source={item.tracks[0]?.artworkSmall || item.tracks[0]?.artwork} size={38} />
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
                style={[styles.buttonPrimary, !name.trim() && styles.disabled]}
                onPress={createAndFile}
                disabled={!name.trim()}
                accessibilityRole="button"
              >
                <Text style={styles.buttonPrimaryText}>Create</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.buttonGhost} onPress={() => setCreating(true)} accessibilityRole="button">
              <ListPlus size={15} color={colors.text} />
              <Text style={styles.buttonGhostText}>New playlist</Text>
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
  const trackId = track?.id;

  // Every song that reaches the mini player is a play: that is the only
  // listening history melo keeps, and what Home seeds the daily mix from.
  useEffect(() => {
    if (track) useLibrary.getState().recordPlay(track);
  }, [trackId]);

  if (!track) return null;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  return (
    <Pressable
      style={styles.miniPlayer}
      onPress={() => navigation.navigate('NowPlaying')}
      accessibilityRole="button"
      accessibilityLabel={`Open ${track.title}`}
    >
      <Artwork source={track.artworkSmall || track.artwork} size={42} />
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
      <PressableScale
        style={styles.miniPlay}
        onPress={togglePlayback}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause' : 'Play'}
      >
        {status.playing ? (
          <Pause size={16} color={colors.accentInk} fill={colors.accentInk} />
        ) : (
          <Play size={16} color={colors.accentInk} fill={colors.accentInk} />
        )}
      </PressableScale>
      <Pressable style={styles.iconButton} onPress={skipNext} accessibilityRole="button" accessibilityLabel="Next track">
        <SkipForward size={18} color={colors.text} />
      </Pressable>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  orbOuter: { width: 620, height: 620, borderRadius: 310, opacity: 0.05 },
  orbInner: { width: 380, height: 380, borderRadius: 190, opacity: 0.1 },
  glassPanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.glassLine,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  glassTile: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 7,
  },
  artwork: { backgroundColor: colors.surfaceRaised },
  artworkFallback: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  label: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionHeader: { marginTop: 30, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionHeading: { flex: 1, minWidth: 0 },
  sectionTitle: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 21, letterSpacing: -0.5 },
  sectionSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, marginTop: 3 },
  errorBanner: { backgroundColor: colors.paleRed, borderColor: 'rgba(255,138,134,0.28)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: colors.danger, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
  emptyState: { paddingVertical: 26, paddingHorizontal: 6 },
  emptyText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21 },
  emptyAction: { marginTop: 14, flexDirection: 'row' },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  trackMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  trackText: { flex: 1, minWidth: 0 },
  trackTitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 14.5 },
  currentTrack: { color: '#FFFFFF' },
  trackSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5, marginTop: 2 },
  duration: { color: colors.muted, fontFamily: fonts.mono, fontSize: 10.5 },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  index: { color: colors.muted, fontFamily: fonts.mono, fontSize: 10.5, width: 16, textAlign: 'right' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonPrimaryText: { color: colors.accentInk, fontFamily: fonts.sansBold, fontSize: 13.5 },
  buttonGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonGhostText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 13.5 },
  disabled: { opacity: 0.4 },
  miniPlayer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.glassStrong,
    borderColor: colors.glassLine,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 7,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  miniText: { flex: 1, minWidth: 0 },
  miniTitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 13 },
  miniSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, marginTop: 1 },
  miniPlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 6, overflow: 'hidden', borderRadius: 2 },
  progressFill: { height: 2, backgroundColor: colors.text, borderRadius: 2 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  backdrop: { flex: 1, backgroundColor: '#000000B3', alignItems: 'center', justifyContent: 'center', padding: 22 },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  dialogTitle: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 21, letterSpacing: -0.4 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 2 },
  sheetBackdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    padding: 18,
    paddingBottom: 26,
    gap: 8,
    maxHeight: '76%',
  },
  sheetSubtitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 15, marginBottom: 4 },
  sheetList: { marginTop: 4 },
  sheetEmpty: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12.5, paddingVertical: 10 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  sheetRowText: { flex: 1, minWidth: 0 },
  added: { color: colors.text, fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  createInput: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
