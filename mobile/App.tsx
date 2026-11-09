import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useAudioPlaylistStatus } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { useFonts } from 'expo-font';
import { Newsreader_500Medium, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { ArrowLeft, ChevronDown, ChevronRight, Home, Library, Link2, ListMusic, Pause, Pencil, Play, Plus, Quote, RefreshCw, Search, Settings, SkipBack, SkipForward, Trash2, X } from 'lucide-react-native';
import { fetchHome, searchAudius } from './src/api';
import { AddToPlaylistSheet, colors, EmptyState, ErrorBanner, fonts, formatTime, MiniPlayer, PromptModal, SectionTitle, Artwork, TrackRow } from './src/components';
import { LyricsSheet } from './src/lyrics-view';
import { useUi } from './src/ui';
import { initPlayer, playTracks, playlist, seekBy, seekTo, skipNext, skipPrevious, togglePlayback, usePlayer } from './src/player';
import { findPlaylistByName, hydrateLibrary, useLibrary } from './src/library';
import { hydrateSettings, useSettings } from './src/settings';
import { importPlaylist, type ImportProgress, type ImportResult } from './src/import';
import type { AlbumSummary, ArtistSummary, HomeSection, SearchResults, Track } from './src/types';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>Loading melo…</Text>
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
  const playlists = useLibrary((s) => s.playlists);
  const [creating, setCreating] = useState(false);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle}>Library</Text>
        <Text style={styles.pageSubtitle}>Playlists live on this phone — no account, no sync.</Text>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => setCreating(true)} accessibilityRole="button">
            <Plus size={16} color={colors.text} />
            <Text style={styles.actionButtonText}>New playlist</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Import')} accessibilityRole="button">
            <Link2 size={16} color={colors.text} />
            <Text style={styles.actionButtonText}>Import</Text>
          </Pressable>
        </View>

        <SectionTitle title="Playlists" subtitle={playlists.length ? `${playlists.length} saved on this device` : undefined} />
        {playlists.length === 0 ? (
          <EmptyState>No playlists yet. Create one here, add songs from any track row, or import a Spotify or YouTube Music playlist.</EmptyState>
        ) : null}
        {playlists.map((item) => (
          <Pressable
            key={item.id}
            style={styles.playlistRow}
            onPress={() => navigation.navigate('Playlist', { id: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`Open playlist ${item.name}`}
          >
            <Artwork source={item.tracks[0]?.artworkSmall || item.tracks[0]?.artwork} size={52} />
            <View style={styles.personText}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.trackSubtitle}>
                {item.tracks.length} {item.tracks.length === 1 ? 'song' : 'songs'}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ))}

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
      <PromptModal
        visible={creating}
        title="New playlist"
        placeholder="Playlist name"
        submitLabel="Create"
        onClose={() => setCreating(false)}
        onSubmit={(name) => {
          const id = useLibrary.getState().createPlaylist(name);
          setCreating(false);
          navigation.navigate('Playlist', { id });
        }}
      />
    </SafeAreaView>
  );
}

function PlaylistScreen({ route, navigation }: any) {
  const playlistId = route.params?.id as string;
  const item = useLibrary((s) => s.playlists.find((p) => p.id === playlistId));
  const [renaming, setRenaming] = useState(false);

  if (!item) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.muted}>This playlist was deleted.</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const remove = (trackId: string, title: string) => {
    Alert.alert('Remove song?', `“${title}” will leave this playlist.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => useLibrary.getState().removeTrack(item.id, trackId) },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete playlist?', `“${item.name}” and its ${item.tracks.length} songs are removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          useLibrary.getState().deletePlaylist(item.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Playlist</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => setRenaming(true)} accessibilityRole="button" accessibilityLabel="Rename playlist">
            <Pencil size={18} color={colors.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={confirmDelete} accessibilityRole="button" accessibilityLabel="Delete playlist">
            <Trash2 size={18} color={colors.danger} />
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.pageSubtitle}>
          {item.tracks.length} {item.tracks.length === 1 ? 'song' : 'songs'} · saved on this device
        </Text>
        {item.tracks.length ? (
          <Pressable style={styles.playAllButton} onPress={() => playTracks(item.tracks, 0)} accessibilityRole="button" accessibilityLabel={`Play ${item.name}`}>
            <Play size={18} color={colors.bg} fill={colors.bg} />
            <Text style={styles.playAllText}>Play all</Text>
          </Pressable>
        ) : (
          <EmptyState>This playlist is empty. Use the playlist button on any song to add one.</EmptyState>
        )}
        {item.tracks.map((track, index) => (
          <TrackRow
            key={`${track.id}-${index}`}
            track={track}
            context={item.tracks}
            onRemove={() => remove(track.id, track.title)}
          />
        ))}
      </ScrollView>
      <PromptModal
        visible={renaming}
        title="Rename playlist"
        placeholder="Playlist name"
        initialValue={item.name}
        submitLabel="Rename"
        onClose={() => setRenaming(false)}
        onSubmit={(name) => {
          useLibrary.getState().renamePlaylist(item.id, name);
          setRenaming(false);
        }}
      />
    </SafeAreaView>
  );
}

function ImportScreen({ navigation }: any) {
  const serverUrl = useSettings((s) => s.serverUrl);
  const [link, setLink] = useState('');
  const [phase, setPhase] = useState<'idle' | 'reading' | 'matching' | 'saving'>('idle');
  const [progress, setProgress] = useState<ImportProgress>({ phase: 'reading', done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: ImportResult; playlistId: string | null } | null>(null);
  const cancelled = useRef(false);
  const busy = phase !== 'idle';

  const run = async () => {
    const value = link.trim();
    if (!value || busy) return;
    cancelled.current = false;
    setError(null);
    setResult(null);
    setPhase('reading');
    setProgress({ phase: 'reading', done: 0, total: 0 });
    try {
      const data = await importPlaylist(value, serverUrl, (next) => {
        if (cancelled.current) return;
        setProgress(next);
        setPhase(next.phase);
      });
      if (cancelled.current) return;
      setPhase('saving');
      let playlistId: string | null = null;
      if (data.tracks.length) {
        const library = useLibrary.getState();
        const existing = findPlaylistByName(data.name);
        if (existing) {
          library.addTracks(existing.id, data.tracks);
          playlistId = existing.id;
        } else {
          playlistId = library.createPlaylist(data.name, data.tracks);
        }
      }
      setResult({ data, playlistId });
      setPhase('idle');
    } catch (e) {
      if (cancelled.current) return;
      setError(e instanceof Error ? e.message : 'Import failed.');
      setPhase('idle');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close import">
          <X size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Import a playlist</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Playlist link</Text>
        <TextInput
          value={link}
          onChangeText={setLink}
          placeholder="Spotify or YouTube Music link"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!busy}
        />
        <Text style={styles.fieldHint}>
          Paste a public playlist. Spotify playlists are read here on the phone and matched to the catalogue. YouTube
          playlists are read by your melo server{serverUrl ? '' : ' — add one in Settings first'}.
        </Text>

        {error ? <ErrorBanner message={error} /> : null}

        {busy ? (
          <View style={styles.progressCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>
              {phase === 'reading' && (progress.total ? `Reading… ${progress.done}/${progress.total}` : 'Reading the playlist…')}
              {phase === 'matching' && `Matching songs… ${progress.done}/${progress.total || '?'}`}
              {phase === 'saving' && 'Saving your playlist…'}
            </Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultCard}>
            {result.data.tracks.length ? (
              <Text style={styles.resultText}>
                <Text style={styles.resultStrong}>
                  {result.data.tracks.length} {result.data.tracks.length === 1 ? 'song' : 'songs'}
                </Text>{' '}
                imported into <Text style={styles.resultStrong}>“{result.data.name}”</Text>.
                {result.data.duplicates > 0 ? ` ${result.data.duplicates} already there.` : ''}
                {result.data.missing.length > 0 ? ` ${result.data.missing.length} not found.` : ''}
              </Text>
            ) : (
              <Text style={styles.resultText}>
                <Text style={styles.resultStrong}>Nothing imported.</Text> None of the songs in “{result.data.name}”
                are in a catalogue this app can play.
              </Text>
            )}
            {result.data.missing.length > 0 ? (
              <Text style={styles.fieldHint}>
                Skipped: {result.data.missing.slice(0, 4).join(' · ')}
                {result.data.missing.length > 4 ? ` · +${result.data.missing.length - 4} more` : ''}
              </Text>
            ) : null}
            {result.data.capped ? (
              <Text style={styles.fieldHint}>This playlist is longer than melo imports in one go, so later songs were left out.</Text>
            ) : null}
            {result.playlistId ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => navigation.replace('Playlist', { id: result.playlistId })}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Open playlist</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, styles.importButton, (busy || !link.trim()) && styles.buttonDisabled]}
          onPress={() => void run()}
          disabled={busy || !link.trim()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>{busy ? 'Importing…' : 'Import playlist'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsScreen() {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const savedServer = useSettings((s) => s.serverUrl);
  const setServerUrl = useSettings((s) => s.setServerUrl);
  const [serverDraft, setServerDraft] = useState(savedServer);
  const [serverNote, setServerNote] = useState<string | null>(null);
  const [testingServer, setTestingServer] = useState(false);

  useEffect(() => {
    setServerDraft(savedServer);
  }, [savedServer]);

  const testServer = async () => {
    const target = serverDraft.trim();
    if (!target) {
      setServerNote('Enter the address of the computer running melo.');
      return;
    }
    setTestingServer(true);
    setServerNote(null);
    try {
      setServerUrl(target);
      const base = useSettings.getState().serverUrl;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${base}/api/providers?check=1`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`The server answered ${res.status}.`);
      const payload = (await res.json()) as { providers?: { provider: string; available: boolean; label: string }[] };
      const youtube = payload.providers?.find((p) => p.provider === 'youtube');
      setServerNote(
        youtube?.available
          ? 'Server reachable, and its YouTube Music source can stream. YouTube playlist import will work.'
          : 'Server reachable, but its YouTube Music source cannot stream on that host, so YouTube import will not find songs.',
      );
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      setServerNote(aborted ? 'The server did not answer in time.' : e instanceof Error ? e.message : 'Could not reach that server.');
    } finally {
      setTestingServer(false);
    }
  };

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

        <SectionTitle title="Melo server" subtitle="Optional. Needed for YouTube playlists and YouTube playback." />
        <TextInput
          value={serverDraft}
          onChangeText={setServerDraft}
          placeholder="http://192.168.1.20:3000"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.fieldHint}>
          Run melo on a computer on the same network and enter its address. Playlists and search never depend on it —
          only YouTube songs do, because reading YouTube needs yt-dlp.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={() => void testServer()} disabled={testingServer} accessibilityRole="button">
          <RefreshCw size={16} color={colors.text} />
          <Text style={styles.secondaryButtonText}>{testingServer ? 'Checking…' : 'Save and test'}</Text>
        </Pressable>
        {serverNote ? <Text style={styles.result}>{serverNote}</Text> : null}

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
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  const duration = status.duration || track.duration || 0;
  const art = track.artwork || track.artworkSmall;
  return (
    <View style={styles.nowStage}>
      {art ? (
        <Image source={{ uri: art }} style={StyleSheet.absoluteFill} blurRadius={48} resizeMode="cover" />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.nowScrim]} />
      <SafeAreaView style={styles.nowStage} edges={['top', 'bottom']}>
        <View style={styles.nowHeader}>
          <Pressable style={styles.nowIcon} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close now playing">
            <ChevronDown size={22} color={colors.accentInk} />
          </Pressable>
          <Text style={styles.nowLabel}>Now playing</Text>
          <Pressable style={styles.nowIcon} onPress={() => navigation.navigate('Queue')} accessibilityRole="button" accessibilityLabel="Open queue">
            <ListMusic size={20} color={colors.accentInk} />
          </Pressable>
        </View>

        <View style={styles.nowBody}>
          <Artwork source={art} size={286} rounded={10} />
          <View style={styles.nowText}>
            <Text style={styles.nowTitle} numberOfLines={2}>
              {track.title}
            </Text>
            <Text style={styles.nowArtist} numberOfLines={1}>
              {track.artist}
            </Text>
            {track.album ? (
              <Text style={styles.nowMeta} numberOfLines={1}>
                {track.album}
              </Text>
            ) : null}
          </View>

          <Slider
            value={status.currentTime}
            minimumValue={0}
            maximumValue={duration || 1}
            onSlidingComplete={seekTo}
            minimumTrackTintColor={colors.accentInk}
            maximumTrackTintColor="rgba(251,250,247,0.22)"
            thumbTintColor={colors.accentInk}
            style={styles.slider}
          />
          <View style={styles.nowTimeRow}>
            <Text style={styles.nowTime}>{formatTime(status.currentTime)}</Text>
            <Text style={styles.nowTime}>-{formatTime(Math.max(0, duration - status.currentTime))}</Text>
          </View>

          <View style={styles.nowControls}>
            <Pressable style={styles.nowControl} onPress={skipPrevious} accessibilityRole="button" accessibilityLabel="Previous track">
              <SkipBack size={26} color={colors.accentInk} />
            </Pressable>
            <Pressable style={styles.nowPlay} onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Play'}>
              {status.playing ? (
                <Pause size={26} color="#141312" fill="#141312" />
              ) : (
                <Play size={26} color="#141312" fill="#141312" />
              )}
            </Pressable>
            <Pressable style={styles.nowControl} onPress={skipNext} accessibilityRole="button" accessibilityLabel="Next track">
              <SkipForward size={26} color={colors.accentInk} />
            </Pressable>
          </View>

          <View style={styles.nowActionsRow}>
            <Pressable
              style={styles.nowAction}
              onPress={() => useUi.getState().openLyrics(track)}
              accessibilityRole="button"
              accessibilityLabel="Show synced lyrics"
            >
              <Quote size={13} color={colors.accentInk} />
              <Text style={styles.nowActionText}>Lyrics</Text>
            </Pressable>
            <Pressable style={styles.nowAction} onPress={() => seekBy(-10)} accessibilityRole="button" accessibilityLabel="Back 10 seconds">
              <Text style={styles.nowActionText}>−10s</Text>
            </Pressable>
            <Pressable style={styles.nowAction} onPress={() => seekBy(10)} accessibilityRole="button" accessibilityLabel="Forward 10 seconds">
              <Text style={styles.nowActionText}>+10s</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
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
          tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
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
  const libraryReady = useLibrary((s) => s.ready);
  const settingsReady = useSettings((s) => s.ready);
  const [fontsLoaded] = useFonts({
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  useEffect(() => {
    void initPlayer();
    void hydrateLibrary();
    void hydrateSettings();
  }, []);

  if (!libraryReady || !settingsReady || !fontsLoaded) return <Loading />;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Playlist" component={PlaylistScreen} />
            <Stack.Screen name="Import" component={ImportScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="NowPlaying" component={NowPlayingScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Queue" component={QueueScreen} options={{ presentation: 'modal' }} />
          </Stack.Navigator>
        </NavigationContainer>
        <AddToPlaylistSheet />
        <LyricsSheet />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 170 },
  pageTitle: { color: colors.text, fontFamily: fonts.serif, fontSize: 34, letterSpacing: -0.7 },
  pageSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.bg },
  muted: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13 },
  loadingText: { color: colors.muted, fontSize: 13 },
  rail: { gap: 12, paddingRight: 20 },
  card: { width: 132, gap: 4 },
  cardTitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 6 },
  cardSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5 },
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
    marginBottom: 10,
  },
  trackTitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 14.5 },
  trackSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5, marginTop: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  personText: { flex: 1, minWidth: 0 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
  },
  secondaryButtonText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 13 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 11, alignItems: 'center' },
  primaryButtonText: { color: colors.accentInk, fontFamily: fonts.sansBold, fontSize: 13.5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingText: { flex: 1, minWidth: 0 },
  result: { color: colors.text, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 19, marginTop: 10 },
  body: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
  },
  actionButtonText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 12.5 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  headerLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 13,
    marginBottom: 12,
  },
  playAllText: { color: colors.accentInk, fontFamily: fonts.sansBold, fontSize: 14 },
  fieldLabel: { color: colors.muted, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  fieldHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  resultCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 12, gap: 6 },
  resultText: { color: colors.text, fontFamily: fonts.sans, fontSize: 13, lineHeight: 20 },
  resultStrong: { fontFamily: fonts.sansBold },
  importButton: { alignSelf: 'stretch', alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.4 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },

  nowStage: { flex: 1, backgroundColor: '#141312' },
  nowScrim: { backgroundColor: 'rgba(20,19,18,0.86)' },
  nowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  nowLabel: { color: 'rgba(251,250,247,0.45)', fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  nowIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  nowBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 16, gap: 16 },
  nowText: { width: '100%', alignItems: 'center', gap: 5 },
  nowTitle: { color: colors.accentInk, fontFamily: fonts.serif, fontSize: 27, lineHeight: 32, textAlign: 'center', letterSpacing: -0.4 },
  nowArtist: { color: 'rgba(251,250,247,0.72)', fontFamily: fonts.sansMedium, fontSize: 14, textAlign: 'center' },
  nowMeta: { color: 'rgba(251,250,247,0.4)', fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  slider: { width: '100%', height: 32 },
  nowTimeRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  nowTime: { color: 'rgba(251,250,247,0.5)', fontFamily: fonts.mono, fontSize: 10.5 },
  nowControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  nowPlay: { width: 62, height: 62, borderRadius: 10, backgroundColor: colors.accentInk, alignItems: 'center', justifyContent: 'center' },
  nowControl: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  nowActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  nowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(251,250,247,0.18)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nowActionText: { color: colors.accentInk, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
});
