import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Quote, X } from 'lucide-react-native';
import { useAudioPlaylistStatus } from 'expo-audio';
import { colors, fonts } from './components';
import { playlist, seekTo, usePlayer } from './player';
import { useUi } from './ui';
import { loadLyrics, type Lyrics } from './lyrics';

/**
 * Lyrics for any song, from the row's long press or the player's Lyrics button.
 * Synced lines highlight with playback and jump the player when tapped; records
 * without timestamps are labelled instead of pretending to follow along.
 */

/** Active line sits above centre so the next lines stay readable. */
const FOCUS_OFFSET = 150;

function activeLine(lyrics: Lyrics | null, time: number) {
  if (!lyrics?.synced || !lyrics.lines.length) return -1;
  let index = -1;
  for (let i = 0; i < lyrics.lines.length; i += 1) {
    if (lyrics.lines[i].time <= time + 0.15) index = i;
    else break;
  }
  return index;
}

export function LyricsSheet() {
  const track = useUi((s) => s.lyricsTrack);
  const close = useUi((s) => s.closeLyrics);
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<number[]>([]);
  /** Reading ahead shouldn't be yanked back; follow pauses briefly after a drag. */
  const pausedUntil = useRef(0);
  const positioned = useRef(false);

  const current = queue[status.currentIndex];
  const isCurrent = Boolean(track && current && current.id === track.id);

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    setState('loading');
    setLyrics(null);
    offsets.current = [];
    pausedUntil.current = 0;
    positioned.current = false;
    loadLyrics(track)
      .then((result) => {
        if (cancelled) return;
        setLyrics(result);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [track, attempt]);

  const active = isCurrent ? activeLine(lyrics, status.currentTime) : -1;

  const reveal = (index: number, animated: boolean) => {
    const scroller = scrollRef.current;
    if (!scroller || index < 0) return false;
    const y = offsets.current[index];
    if (typeof y !== 'number') return false;
    scroller.scrollTo({ y: Math.max(0, y - FOCUS_OFFSET), animated });
    positioned.current = true;
    return true;
  };

  useEffect(() => {
    if (active < 0) {
      if (Date.now() >= pausedUntil.current) scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (Date.now() < pausedUntil.current) return;
    // Opening mid-song lands on the current line; later changes glide.
    reveal(active, positioned.current);
  }, [active]);

  return (
    <Modal visible={Boolean(track)} animationType="slide" onRequestClose={close}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.label}>Lyrics</Text>
          <Pressable style={styles.close} onPress={close} accessibilityRole="button" accessibilityLabel="Close lyrics">
            <X size={18} color={colors.text} />
          </Pressable>
        </View>

        {track ? (
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>
              {track.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>
        ) : null}

        {state === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.muted}>Looking for lyrics…</Text>
          </View>
        ) : state === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.muted}>LRCLIB could not be reached.</Text>
            <Pressable style={styles.retry} onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : !lyrics || (!lyrics.lines.length && !lyrics.instrumental) ? (
          <View style={styles.center}>
            <Quote size={22} color={colors.muted} />
            <Text style={styles.muted}>No lyrics for this song yet. LRCLIB is community-sourced and doesn&rsquo;t cover everything.</Text>
            <Pressable style={styles.retry} onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
              <Text style={styles.retryText}>Search again</Text>
            </Pressable>
          </View>
        ) : lyrics.instrumental ? (
          <View style={styles.center}>
            <Text style={styles.muted}>LRCLIB marks this track as instrumental.</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.lines}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => {
              pausedUntil.current = Date.now() + 4000;
            }}
          >
            {!lyrics.synced ? <Text style={styles.unsynced}>Not time-synced</Text> : null}
            {lyrics.lines.map((line, index) => {
              const isActive = index === active;
              return (
                <Pressable
                  key={`${index}-${line.text}`}
                  onLayout={(event) => {
                    offsets.current[index] = event.nativeEvent.layout.y;
                    // First paint of an already-playing song: land on the line, don't glide from 0.
                    if (!positioned.current && index === active && Date.now() >= pausedUntil.current) {
                      reveal(index, false);
                    }
                  }}
                  onPress={() => {
                    if (lyrics.synced && isCurrent) seekTo(line.time);
                  }}
                  disabled={!lyrics.synced || !isCurrent}
                  accessibilityRole="button"
                  accessibilityLabel={line.text}
                >
                  <Text style={[styles.line, isActive && styles.lineActive]}>{line.text}</Text>
                </Pressable>
              );
            })}
            <Text style={styles.credit}>Lyrics from LRCLIB · community-sourced</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 54 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  label: { color: colors.muted, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { color: colors.text, fontFamily: fonts.serif, fontSize: 27, lineHeight: 32, letterSpacing: -0.4 },
  artist: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 34 },
  muted: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21, textAlign: 'center' },
  retry: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 12.5 },
  lines: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 60 },
  unsynced: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  line: {
    color: colors.muted,
    fontFamily: fonts.serif,
    fontSize: 19,
    lineHeight: 30,
    paddingVertical: 5,
  },
  lineActive: { color: colors.text, fontFamily: fonts.serifSemi },
  credit: {
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    marginTop: 26,
    textTransform: 'uppercase',
  },
});
