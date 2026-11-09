import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, MessageCircle, RefreshCw } from 'lucide-react-native';
import { useAudioPlaylistStatus } from 'expo-audio';
import { fonts } from './components';
import { playlist, seekTo, usePlayer } from './player';
import { useUi } from './ui';
import { loadLyrics, type Lyrics } from './lyrics';

/**
 * Lyrics for any song, from the row's long press or the player's bubble.
 *
 * The requested look is a focus band: the line being sung is crisp and white,
 * neighbours step back, and the edges of the screen fall away. React Native
 * can't Gaussian-blur a run of text without a native module, so the band is
 * built from per-line opacity plus stacked scrim strips. It reads the same way
 * in motion — the eye lands on one line — and it keeps the app dependency-free.
 */

/** Active line sits above centre so the next lines stay readable. */
const FOCUS_OFFSET = 168;

function activeLine(lyrics: Lyrics | null, time: number) {
  if (!lyrics?.synced || !lyrics.lines.length) return -1;
  let index = -1;
  for (let i = 0; i < lyrics.lines.length; i += 1) {
    if (lyrics.lines[i].time <= time + 0.15) index = i;
    else break;
  }
  return index;
}

/** Distance from the sung line decides how far a line steps back. */
function lineStyle(distance: number) {
  if (distance === 0) return styles.lineActive;
  if (distance === 1) return styles.lineNear;
  if (distance === 2) return styles.lineMid;
  return styles.lineFar;
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
  const art = track?.artwork || track?.artworkSmall;

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
    <Modal visible={Boolean(track)} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.screen}>
        {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} blurRadius={52} resizeMode="cover" /> : null}
        <View style={[StyleSheet.absoluteFill, styles.stageScrim]} />

        <View style={styles.header}>
          <Pressable style={styles.close} onPress={close} accessibilityRole="button" accessibilityLabel="Close lyrics">
            <ChevronDown size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {track?.title ?? 'Lyrics'}
            </Text>
            <Text style={styles.headerArtist} numberOfLines={1}>
              {track?.artist ?? ''}
            </Text>
          </View>
          <View style={styles.close} />
        </View>

        {state === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.muted}>Looking for lyrics…</Text>
          </View>
        ) : state === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.muted}>LRCLIB could not be reached. Nothing is cached offline yet.</Text>
            <Pressable style={styles.retry} onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
              <RefreshCw size={15} color="#FFFFFF" />
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : !lyrics || (!lyrics.lines.length && !lyrics.instrumental) ? (
          <View style={styles.center}>
            <MessageCircle size={26} color="rgba(255,255,255,0.6)" />
            <Text style={styles.muted}>
              No lyrics found for this song. LRCLIB is community-sourced and doesn&rsquo;t cover everything.
            </Text>
            <Pressable style={styles.retry} onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
              <RefreshCw size={15} color="#FFFFFF" />
              <Text style={styles.retryText}>Search again</Text>
            </Pressable>
          </View>
        ) : lyrics.instrumental ? (
          <View style={styles.center}>
            <Text style={styles.muted}>LRCLIB marks this track as instrumental.</Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.lines}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => {
                pausedUntil.current = Date.now() + 4000;
              }}
            >
              {!lyrics.synced ? <Text style={styles.unsynced}>Not time-synced — reading order only</Text> : null}
              {lyrics.lines.map((line, index) => {
                const distance = active < 0 ? 3 : Math.abs(index - active);
                const isActive = index === active;
                return (
                  <Pressable
                    key={`${index}-${line.text}`}
                    onLayout={(event) => {
                      offsets.current[index] = event.nativeEvent.layout.y;
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
                    <Text style={[styles.line, lineStyle(distance)]}>{line.text}</Text>
                    {isActive ? <View style={styles.activeRule} /> : null}
                  </Pressable>
                );
              })}

              <View style={styles.source}>
                <Text style={styles.sourceLabel}>Lyrics source</Text>
                <Text style={styles.sourceText}>
                  {lyrics.synced ? 'Time-synced by LRCLIB' : 'Plain text from LRCLIB'}
                  {lyrics.matched
                    ? ` · matched to “${lyrics.matched.trackName}” by ${lyrics.matched.artistName}`
                    : ''}
                </Text>
                <Text style={styles.sourceHint}>
                  Community-contributed and may be incomplete, or timed slightly off.
                </Text>
              </View>
            </ScrollView>

            {/* Edge scrims: the band reads as blurred top and bottom. */}
            <View style={styles.fadeTop} pointerEvents="none">
              <View style={styles.fadeTopA} />
              <View style={styles.fadeTopB} />
              <View style={styles.fadeTopC} />
            </View>
            <View style={styles.fadeBottom} pointerEvents="none">
              <View style={styles.fadeBottomC} />
              <View style={styles.fadeBottomB} />
              <View style={styles.fadeBottomA} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0B', paddingTop: 46 },
  stageScrim: { backgroundColor: 'rgba(10,10,11,0.72)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.sansBold, fontSize: 15, letterSpacing: -0.2 },
  headerArtist: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.sans, fontSize: 11.5, marginTop: 1 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 34 },
  muted: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21, textAlign: 'center' },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: { color: '#FFFFFF', fontFamily: fonts.sansMedium, fontSize: 12.5 },
  listWrap: { flex: 1 },
  lines: { paddingHorizontal: 26, paddingTop: 170, paddingBottom: 240 },
  unsynced: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  line: {
    fontFamily: fonts.sansMedium,
    fontSize: 21,
    lineHeight: 31,
    paddingVertical: 5,
  },
  lineActive: { color: '#FFFFFF', fontFamily: fonts.sansBold, fontSize: 22, lineHeight: 32 },
  lineNear: { color: 'rgba(255,255,255,0.5)' },
  lineMid: { color: 'rgba(255,255,255,0.3)' },
  lineFar: { color: 'rgba(255,255,255,0.16)' },
  activeRule: { width: 18, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginTop: 2 },
  source: { marginTop: 44, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)', gap: 6 },
  sourceLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  sourceText: { color: 'rgba(255,255,255,0.78)', fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 19 },
  sourceHint: { color: 'rgba(255,255,255,0.42)', fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 17 },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 190 },
  fadeTopA: { position: 'absolute', top: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(10,10,11,0.92)' },
  fadeTopB: { position: 'absolute', top: 60, left: 0, right: 0, height: 60, backgroundColor: 'rgba(10,10,11,0.62)' },
  fadeTopC: { position: 'absolute', top: 120, left: 0, right: 0, height: 70, backgroundColor: 'rgba(10,10,11,0.32)' },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 170 },
  fadeBottomA: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(10,10,11,0.9)' },
  fadeBottomB: { position: 'absolute', bottom: 60, left: 0, right: 0, height: 55, backgroundColor: 'rgba(10,10,11,0.55)' },
  fadeBottomC: { position: 'absolute', bottom: 115, left: 0, right: 0, height: 55, backgroundColor: 'rgba(10,10,11,0.28)' },
});
