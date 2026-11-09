import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useAudioPlaylistStatus } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { ChevronDown, Home, Library, ListMusic, Pause, Play, RefreshCw, Search, Settings, SkipBack, SkipForward, X } from 'lucide-react-native';
import { fetchHome, searchAudius } from './src/api';
import { colors, EmptyState, ErrorBanner, formatTime, MiniPlayer, SectionTitle, Artwork, TrackRow } from './src/components';
import { initPlayer, playTracks, playlist, seekBy, seekTo, skipNext, skipPrevious, togglePlayback, usePlayer } from './src/player';
import type { AlbumSummary, ArtistSummary, HomeSection, SearchResults, Track } from './src/types';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>Loading melo…</Text>
    </View>
  );
}

function HomeScreen() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSections(await fetchHome());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load melo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); void load(); }} />}>
        <Text style={styles.pageTitle}>Home</Text>
        <Text style={styles.pageSubtitle}>Your music, your way.</Text>
        {error ? <ErrorBanner message={error} /> : null}
        {sections.length === 0 && !error ? <EmptyState>No music loaded yet.</EmptyState> : null}
        {sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionBlock({ section }: { section: HomeSection }) {
  return (
    <View>
      <SectionTitle title={section.title} subtitle={section.subtitle} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {section.kind === 'tracks'
          ? (section.items as Track[]).map((track, index, arr) => <TrackCard key={track.id} track={track} context={arr} index={index} />)
          : section.kind === 'artists'
            ? (section.items as ArtistSummary[]).map((artist) => <PersonCard key={artist.id} name={artist.name} artwork={artist.artwork} round />)
            : (section.items as AlbumSummary[]).map((album) => <PersonCard key={album.id} name={album.name} artwork={album.artwork} subtitle={album.artist} />)}
      </ScrollView>
    </View>
  );
}

function TrackCard({ track, context, index }: { track: Track; context: Track[]; index: number }) {
  return (
    <Pressable style={styles.card} onPress={() => playTracks(context, index)} accessibilityRole="button" accessibilityLabel={`Play ${track.title}`}>
      <Artwork source={track.artworkSmall || track.artwork} size={132} rounded={16} />
      <Text style={styles.cardTitle} numberOfLines={1}>{track.title}</Text>
      <Text style={styles.cardSubtitle} numberOfLines={1}>{track.artist}</Text>
    </Pressable>
  );
}

function PersonCard({ name, artwork, subtitle, round = false }: { name: string; artwork?: string; subtitle?: string; round?: boolean }) {
  return (
    <View style={styles.card}>
      <Artwork source={artwork} size={132} rounded={round ? 66 : 16} />
      <Text style={styles.cardTitle} numberOfLines={1}>{name}</Text>
      {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ tracks: [], artists: [], albums: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults({ tracks: [], artists: [], albums: [] });
      setError(null);
      return;
    }
    setLoading(true);
    const id = setTimeout(() => {
      searchAudius(term)
        .then((res) => { setResults(res); setError(null); })
        .catch((e) => setError(e instanceof Error ? e.message : 'Search failed.'))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Search</Text>
        <Text style={styles.pageSubtitle}>Live catalogue search.</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search songs, artists, albums" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" returnKeyType="search" />
        {loading ? <View style={styles.center}><ActivityIndicator color={colors.accent} /></View> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!query && !loading ? <EmptyState>Search the live Audius catalogue.</EmptyState> : null}
        {results.tracks.length ? <SectionTitle title="Songs" /> : null}
        {results.tracks.map((track, index) => <TrackRow key={track.id} track={track} context={results.tracks} index={index} />)}
        {results.artists.length ? <SectionTitle title="Artists" /> : null}
        {results.artists.map((artist) => (
          <View key={artist.id} style={styles.personRow}>
            <Artwork source={artist.artwork} size={48} rounded={24} />
            <View style={styles.personText}>
              <Text style={styles.trackTitle} numberOfLines={1}>{artist.name}</Text>
              <Text style={styles.trackSubtitle}>{artist.trackCount ? `${artist.trackCount} tracks` : 'Artist'}</Text>
            </View>
          </View>
        ))}
        {results.albums.length ? <SectionTitle title="Albums" /> : null}
        {results.albums.map((album) => (
          <View key={album.id} style={styles.personRow}>
            <Artwork source={album.artwork} size={48} />
            <View style={styles.personText}>
              <Text style={styles.trackTitle} numberOfLines={1}>{album.name}</Text>
              <Text style={styles.trackSubtitle} numberOfLines={1}>{album.artist}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LibraryScreen({ navigation }: any) {
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const current = queue[status.currentIndex];
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle}>Library</Text>
        <Text style={styles.pageSubtitle}>{queue.length ? `${queue.length} in queue` : 'Your queue and local library live here.'}</Text>
        {current ? <SectionTitle title="Now playing" /> : null}
        {current ? <TrackRow track={current} context={queue} /> : null}
        <SectionTitle title="Queue" subtitle={queue.length ? 'Tap to jump to a track.' : undefined} />
        {queue.length === 0 ? <EmptyState>Play a song and it will appear here.</EmptyState> : null}
        {queue.map((track, index) => <TrackRow key={`${track.id}-${index}`} track={track} context={queue} index={index} />)}
        {queue.length ? (
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Queue')} accessibilityRole="button">
            <ListMusic size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Open queue</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsScreen() {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const testSources = async () => {
    setBusy(true);
    setResult(null);
    try {
      const sections = await fetchHome();
      setResult(`Audius is reachable. ${sections.length} home sections loaded.`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Source check failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageSubtitle}>melo Android · React Native + Expo</Text>
        <SectionTitle title="Music source" />
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.trackTitle}>Audius</Text>
            <Text style={styles.trackSubtitle}>Default keyless catalogue source.</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => void testSources()} disabled={busy} accessibilityRole="button">
            <RefreshCw size={16} color={colors.text} />
            <Text style={styles.secondaryButtonText}>{busy ? 'Testing…' : 'Test source'}</Text>
          </Pressable>
        </View>
        {result ? <Text style={styles.result}>{result}</Text> : null}
        <SectionTitle title="About" />
        <Text style={styles.body}>melo is a free, ad-free, account-free music app. This Android build uses React Native with Expo Audio for background playback and lock-screen controls.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function NowPlayingScreen({ navigation }: any) {
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const track = queue[status.currentIndex];
  if (!track) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.muted}>Nothing is playing.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()} accessibilityRole="button"><Text style={styles.primaryButtonText}>Back</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }
  const duration = status.duration || track.duration || 0;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nowPlaying}>
        <View style={styles.nowActions}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close now playing"><ChevronDown size={24} color={colors.text} /></Pressable>
          <Text style={styles.nowLabel}>Now Playing</Text>
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Queue')} accessibilityRole="button" accessibilityLabel="Open queue"><ListMusic size={22} color={colors.text} /></Pressable>
        </View>
        <Artwork source={track.artwork} size={300} rounded={24} />
        <View style={styles.nowText}>
          <Text style={styles.nowTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.nowArtist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <Slider value={status.currentTime} minimumValue={0} maximumValue={duration || 1} onSlidingComplete={seekTo} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.text} style={styles.slider} />
        <View style={styles.timeRow}><Text style={styles.time}>{formatTime(status.currentTime)}</Text><Text style={styles.time}>-{formatTime(Math.max(0, duration - status.currentTime))}</Text></View>
        <View style={styles.controls}>
          <Pressable style={styles.controlButton} onPress={skipPrevious} accessibilityRole="button" accessibilityLabel="Previous track"><SkipBack size={28} color={colors.text} fill={colors.text} /></Pressable>
          <Pressable style={styles.playButton} onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Play'}>{status.playing ? <Pause size={34} color={colors.bg} fill={colors.bg} /> : <Play size={34} color={colors.bg} fill={colors.bg} />}</Pressable>
          <Pressable style={styles.controlButton} onPress={skipNext} accessibilityRole="button" accessibilityLabel="Next track"><SkipForward size={28} color={colors.text} fill={colors.text} /></Pressable>
        </View>
        <View style={styles.seekRow}>
          <Pressable style={styles.secondaryButton} onPress={() => seekBy(-10)} accessibilityRole="button"><Text style={styles.secondaryButtonText}>−10s</Text></Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => seekBy(10)} accessibilityRole="button"><Text style={styles.secondaryButtonText}>+10s</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function QueueScreen({ navigation }: any) {
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.queueHeader}>
        <Text style={styles.pageTitle}>Queue</Text>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close queue"><X size={22} color={colors.text} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        {queue.length === 0 ? <EmptyState>The queue is empty.</EmptyState> : null}
        {queue.map((track, index) => (
          <Pressable key={`${track.id}-${index}`} onPress={() => playTracks(queue, index)} accessibilityRole="button" accessibilityLabel={`Play ${track.title}`}>
            <TrackRow track={track} context={queue} index={index} />
          </Pressable>
        ))}
        {queue.length ? <Text style={styles.muted}>Now: {status.currentIndex + 1} of {queue.length}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MainTabs() {
  return (
    <View style={styles.root}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line, height: 74, paddingBottom: 10 },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
        <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ color, size }) => <Search size={size} color={color} /> }} />
        <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarIcon: ({ color, size }) => <Library size={size} color={color} /> }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color, size }) => <Settings size={size} color={color} /> }} />
      </Tab.Navigator>
      <MiniPlayer />
    </View>
  );
}

export default function App() {
  useEffect(() => {
    void initPlayer();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="NowPlaying" component={NowPlayingScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Queue" component={QueueScreen} options={{ presentation: 'modal' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 18, paddingBottom: 170 },
  pageTitle: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  pageSubtitle: { color: colors.muted, fontSize: 14, marginTop: 3, marginBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg },
  muted: { color: colors.muted, fontSize: 13 },
  rail: { gap: 14, paddingRight: 18 },
  card: { width: 132, gap: 6 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
  cardSubtitle: { color: colors.muted, fontSize: 12 },
  input: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14, color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  trackTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  trackSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  personText: { flex: 1, minWidth: 0 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surfaceRaised, borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, marginTop: 14 },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 },
  primaryButtonText: { color: colors.bg, fontWeight: '800' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingText: { flex: 1, minWidth: 0 },
  result: { color: colors.accent, fontSize: 13, marginTop: 12 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  nowPlaying: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 18 },
  nowActions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nowLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  nowText: { width: '100%', alignItems: 'center', gap: 4 },
  nowTitle: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  nowArtist: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  slider: { width: '100%', height: 36 },
  timeRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 34 },
  controlButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  seekRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 12 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 0 },
});
