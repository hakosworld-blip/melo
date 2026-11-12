import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useAudioPlaylistStatus } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { useFonts } from 'expo-font';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Cog, Home, Library, Link2, ListMusic, MessageCircle, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, Repeat, Repeat1, Search, SkipBack, SkipForward, Star, Trash2, Volume2, X } from 'lucide-react-native';
import { fetchCharts, fetchGenreTracks, searchCatalogue, type ChartArtist } from './src/api';
import { buildHomeFeed, type HomeFeed } from './src/feed';
import { AddToPlaylistSheet, AmbientBackdrop, colors, EmptyState, ErrorBanner, fonts, formatTime, MiniPlayer, PressableScale, PromptModal, RiseIn, SectionTitle, Artwork, TrackRow, useReduceMotion } from './src/components';
import { LyricsSheet } from './src/lyrics-view';
import { useUi } from './src/ui';
import { addToQueue, clearQueue, currentRepeat, currentVolume, cycleRepeat, initPlayer, playTracks, playlist, seekTo, setVolume, skipNext, skipPrevious, togglePlayback, usePlayer, type RepeatMode } from './src/player';
import { findPlaylistByName, hydrateLibrary, useLibrary } from './src/library';
import appConfig from './app.json';
import { hydrateSettings, useSettings } from './src/settings';
import { importPlaylist, type ImportProgress, type ImportResult } from './src/import';
import type { AlbumSummary, ArtistSummary, HomeSection, SearchResults, Track } from './src/types';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** Shuffle here, not in the audio engine: it rebuilds the queue in a new order. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>Loading melo…</Text>
    </View>
  );
}

function HomeScreen({ navigation }: any) {
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllMix, setShowAllMix] = useState(false);
  const [charts, setCharts] = useState<ChartArtist[]>([]);
  const recent = useLibrary((s) => s.recent);
  const pinned = useLibrary((s) => s.pinned);

  const load = useCallback(async (force = false) => {
    setError(null);
    // Charts are independent of the catalogue: they still load when YouTube
    // itself is unreachable on this server.
    const chartsPromise = fetchCharts(5)
      .then((payload) => payload.artists)
      .catch(() => [] as ChartArtist[]);
    try {
      setFeed(await buildHomeFeed(force));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load melo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    setCharts(await chartsPromise);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mix = feed?.mix ?? [];
  const mixMinutes = Math.round(mix.reduce((sum, track) => sum + (track.duration || 0), 0) / 60);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const otherSections = (feed?.sections ?? []).filter((section) => section.id !== 'daily-mix');

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.homePage}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.text}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
          />
        }
      >
        <View style={styles.homeHeader}>
          <Text style={styles.wordmark}>melo</Text>
          <Pressable
            style={styles.avatar}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Cog size={17} color={colors.text} />
          </Pressable>
        </View>

        <RiseIn>
          <Text style={styles.heroTitle}>Listen Now</Text>
          <Text style={styles.heroDate}>
            {greeting} · {today}
          </Text>
        </RiseIn>

        {error ? <ErrorBanner message={error} /> : null}

        {pinned.length ? (
          <View>
            <SectionTitle title="Pinned" subtitle="Starred from the player · tap to play" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {pinned.map((track) => (
                <ArtCard key={track.id} track={track} context={pinned} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {recent.length ? (
          <View>
            <SectionTitle title="Recently played" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {recent.slice(0, 10).map((track) => (
                <ArtCard key={track.id} track={track} context={recent} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {mix.length ? (
          <View>
            <SectionTitle
              title={feed?.personalised ? 'Made for you' : "Today's mix"}
              subtitle={
                feed?.personalised
                  ? 'The artists and genres you play here, reshuffled every day'
                  : 'A fresh set from across the catalogue, every day'
              }
              action={
                <PressableScale
                  style={styles.playPill}
                  onPress={() => playTracks(mix, 0)}
                  accessibilityRole="button"
                  accessibilityLabel="Play the whole mix"
                >
                  <Play size={13} color={colors.accentInk} fill={colors.accentInk} />
                  <Text style={styles.playPillText}>Play</Text>
                </PressableScale>
              }
            />
            <Text style={styles.mixMeta}>
              {mix.length} songs · {mixMinutes} min
              {feed?.personalised ? ' · from your plays on this device' : ''}
            </Text>
            <View style={styles.glassPanel}>
              {(showAllMix ? mix : mix.slice(0, 5)).map((track, index) => (
                <TrackRow key={track.id} track={track} context={mix} index={index} />
              ))}
            </View>
            {mix.length > 5 ? (
              <Pressable
                style={styles.linkButton}
                onPress={() => setShowAllMix((open) => !open)}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>{showAllMix ? 'Show less' : `Show all ${mix.length}`}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {charts.length ? (
          <View>
            <SectionTitle
              title="Worldwide charts"
              subtitle="Artist rankings by monthly listeners · Spotify data from kworb.net"
              action={
                <Pressable onPress={() => navigation.navigate('Charts')} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.linkText}>See all</Text>
                </Pressable>
              }
            />
            <View style={styles.glassPanel}>
              {charts.map((artist) => (
                <View key={artist.name} style={styles.chartRow}>
                  <Text style={styles.chartRank}>{artist.rank}</Text>
                  <View style={styles.chartMeta}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {artist.name}
                    </Text>
                    <Text style={styles.trackSubtitle} numberOfLines={1}>
                      {formatCompact(artist.monthlyListeners)} monthly · {artist.dailyChange >= 0 ? '+' : '−'}
                      {formatCompact(Math.abs(artist.dailyChange))} today
                    </Text>
                  </View>
                  <Text style={styles.chartMetric}>{artist.worldwide ? `#${artist.worldwide.position}` : '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {feed?.genreTiles.length ? (
          <View>
            <SectionTitle title="Genres" subtitle="Browse the catalogue by sound" />
            <View style={styles.genreGrid}>
              {feed.genreTiles.map((genre, index) => (
                <RiseIn key={genre.name} delay={index * 40} style={{ width: '48%' }}>
                <PressableScale
                  style={styles.genreTile}
                  onPress={() => navigation.navigate('Genre', { genre: genre.name })}
                  accessibilityRole="button"
                  accessibilityLabel={`Browse ${genre.name}`}
                >
                  {genre.artwork ? (
                    <Image source={{ uri: genre.artwork }} style={StyleSheet.absoluteFill} blurRadius={16} />
                  ) : null}
                  <View style={styles.genreScrim} />
                  <Text style={styles.genreName} numberOfLines={1}>
                    {genre.name}
                  </Text>
                </PressableScale>
                </RiseIn>
              ))}
            </View>
          </View>
        ) : null}

        {!mix.length && !error ? (
          <EmptyState>Nothing came back from the catalogue just now. Pull down to try again.</EmptyState>
        ) : null}

        {otherSections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Square artwork with a play affordance, as on the phone app's home. */
function ArtCard({ track, context }: { track: Track; context: Track[] }) {
  return (
    <RiseIn>
    <PressableScale
      style={styles.artCard}
      onPress={() => playTracks(context, Math.max(0, context.findIndex((item) => item.id === track.id)))}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title}`}
    >
      <View style={styles.artCardArt}>
        <Artwork source={track.artworkSmall || track.artwork} size={148} rounded={6} />
        <View style={styles.artCardPlay}>
          <Play size={12} color={colors.accentInk} fill={colors.accentInk} />
        </View>
      </View>
      <Text style={styles.artCardTitle} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={styles.artCardSubtitle} numberOfLines={1}>
        {track.artist}
      </Text>
    </PressableScale>
    </RiseIn>
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
    <Pressable
      style={styles.card}
      onPress={() => playTracks(context, index)}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title}`}
    >
      <Artwork source={track.artworkSmall || track.artwork} size={140} rounded={6} />
      <Text style={styles.cardTitle} numberOfLines={1}>
        {track.title}
      </Text>
      <Text style={styles.cardSubtitle} numberOfLines={1}>
        {track.artist}
      </Text>
    </Pressable>
  );
}

function PersonCard({ name, artwork, subtitle, round = false }: { name: string; artwork?: string; subtitle?: string; round?: boolean }) {
  return (
    <View style={styles.card}>
      <Artwork source={artwork} size={140} rounded={round ? 70 : 6} />
      <Text style={styles.cardTitle} numberOfLines={1}>
        {name}
      </Text>
      {subtitle ? (
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
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
      searchCatalogue(term)
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
        {!query && !loading ? <EmptyState>Search YouTube Music. Add your melo server in Settings first.</EmptyState> : null}
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

function GenreScreen({ route, navigation }: any) {
  const genre = (route.params?.genre as string) || '';
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchGenreTracks(genre, 50)
      .then((rows) => {
        if (!alive) return;
        setTracks(rows);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load this genre.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [genre]);

  const minutes = Math.round(tracks.reduce((sum, track) => sum + (track.duration || 0), 0) / 60);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Genre</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle}>{genre}</Text>
        {tracks.length ? (
          <Text style={styles.pageSubtitle}>
            Genre · {tracks.length} songs · {minutes} min · popular this week
          </Text>
        ) : null}
        {tracks.length ? (
          <View style={styles.pillRow}>
            <Pressable style={styles.playPill} onPress={() => playTracks(tracks, 0)} accessibilityRole="button" accessibilityLabel={`Play ${genre}`}>
              <Play size={13} color={colors.accentInk} fill={colors.accentInk} />
              <Text style={styles.playPillText}>Play</Text>
            </Pressable>
            <Pressable
              style={styles.ghostPill}
              onPress={() => playTracks(shuffled(tracks), 0)}
              accessibilityRole="button"
              accessibilityLabel={`Shuffle ${genre}`}
            >
              <Text style={styles.ghostPillText}>Shuffle</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
        {!loading && !error && !tracks.length ? <EmptyState>Nothing came back for this genre just now.</EmptyState> : null}
        {tracks.map((track, index) => (
          <TrackRow key={track.id} track={track} context={tracks} index={index} />
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
        <SectionTitle title="Up next" subtitle={queue.length ? 'The songs that follow this one.' : undefined} />
        {queue.length === 0 ? <EmptyState>Play a song and it will appear here.</EmptyState> : null}
        {queue.slice(status.currentIndex + 1, status.currentIndex + 4).map((track, index) => (
          <TrackRow key={`${track.id}-${index}`} track={track} context={queue} index={status.currentIndex + 1 + index} compact />
        ))}
        {queue.length ? (
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Queue')} accessibilityRole="button">
            <ListMusic size={18} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Open Up next</Text>
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

function SettingsScreen({ navigation }: any) {
  // app.json is what the release workflow stamps, so this is the installed version.
  const appVersion = appConfig.expo?.version ?? '1.0.0';
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageSubtitle}>melo {appVersion} · Android · React Native + Expo</Text>
        <SectionTitle title="Music source" subtitle="One source, no switching" />
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.trackTitle}>YouTube Music</Text>
            <Text style={styles.trackSubtitle}>
              Streaming only, through your melo server. There is no second catalogue.
            </Text>
          </View>
        </View>

        <SectionTitle title="Charts" subtitle="Artist rankings, daily streams and worldwide positions" />
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Charts')}
          accessibilityRole="button"
          accessibilityLabel="Open worldwide charts"
        >
          <ChevronRight size={16} color={colors.text} />
          <Text style={styles.secondaryButtonText}>Open worldwide charts</Text>
        </Pressable>

        <SectionTitle title="Melo server" subtitle="Required. Every song is read and streamed through it." />
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

        <SectionTitle
          title="Listening history"
          subtitle="Kept on this phone only. Home's daily mix is seeded from it."
        />
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            Alert.alert('Forget what you played?', 'Recently played and the daily-mix seeds are cleared. Pinned songs and playlists stay.', [
              { text: 'Keep', style: 'cancel' },
              { text: 'Forget', style: 'destructive', onPress: () => useLibrary.getState().clearHistory() },
            ])
          }
          accessibilityRole="button"
        >
          <Trash2 size={16} color={colors.text} />
          <Text style={styles.secondaryButtonText}>Forget listening history</Text>
        </Pressable>

        <SectionTitle title="About" />
        <Text style={styles.body}>
          melo is a free, ad-free, account-free music app. This Android build uses React Native with Expo Audio for
          background playback and lock-screen controls. Lyrics come from LRCLIB, and the credit under a song always
          names the record that was matched.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

/**
 * Worldwide charts.
 *
 * kworb.net's Spotify leaderboard: rank by monthly listeners, the day's change,
 * and the artist's best position on the global daily chart. It is a read of
 * public statistics, not melo's own play data.
 */
function ChartsScreen({ navigation }: any) {
  const [data, setData] = useState<{ source: string; updated: string | null; artists: ChartArtist[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCharts(25)
      .then((payload) => setData(payload))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load charts.'));
  }, []);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
        >
          <ChevronRight size={20} color={colors.muted} style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <Text style={styles.pageTitle}>Worldwide charts</Text>
        <Text style={styles.pageSubtitle}>
          Ranked by monthly listeners · Spotify data from kworb.net
          {data?.updated ? ` · ${data.updated}` : ''}
        </Text>
        {error ? <ErrorBanner message={error} /> : null}
        {!data && !error ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}
        {data?.artists.map((artist) => (
          <View key={artist.name} style={styles.settingRow}>
            <Text style={{ width: 26, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.muted }}>{artist.rank}</Text>
            <View style={styles.settingText}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {artist.name}
              </Text>
              <Text style={styles.trackSubtitle}>
                {formatCompact(artist.monthlyListeners)} monthly · {artist.dailyChange >= 0 ? '+' : '−'}
                {formatCompact(Math.abs(artist.dailyChange))} today
                {artist.worldwide ? ` · #${artist.worldwide.position} worldwide` : ''}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function NowPlayingScreen({ navigation }: any) {
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const track = queue[status.currentIndex];
  const pinnedTracks = useLibrary((s) => s.pinned);
  const [menuOpen, setMenuOpen] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>(() => currentRepeat());
  const [volume, setVolumeState] = useState(() => currentVolume());
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The cover takes whatever room the controls leave, measured rather than
  // guessed, so short phones never push the dock off screen.
  const [artBox, setArtBox] = useState({ width: 0, height: 0 });

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

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
  const isPinned = pinnedTracks.some((item) => item.id === track.id);

  const showNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  };

  const togglePin = () => {
    const nowPinned = useLibrary.getState().togglePin(track);
    setMenuOpen(false);
    showNotice(nowPinned ? 'Pinned to Home' : 'Removed from Home');
  };

  return (
    <View style={styles.nowStage}>
      {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} blurRadius={46} resizeMode="cover" /> : null}
      <View style={[StyleSheet.absoluteFill, styles.nowScrim]} />
      <SafeAreaView style={styles.nowStage} edges={['top', 'bottom']}>
        <View style={styles.nowHeader}>
          <Pressable style={styles.nowIcon} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close player">
            <ChevronDown size={24} color="#FFFFFF" />
          </Pressable>
          <View style={styles.grabber} />
          <View style={styles.nowIcon} />
        </View>

        <View style={styles.nowBody}>
          <View
            style={styles.nowArtWrap}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setArtBox({ width, height });
            }}
          >
            {artBox.width > 0 ? (
              <ArtSwap key={track.id} uri={art} size={Math.max(120, Math.min(artBox.width, artBox.height))} />
            ) : null}
          </View>

          <View style={styles.nowText}>
            <Text style={styles.nowTitle} numberOfLines={2}>
              {track.title}
            </Text>
            <Text style={styles.nowArtist} numberOfLines={1}>
              <Text style={styles.nowArtistName}>{track.artist}</Text>
              {track.album ? <Text style={styles.nowMeta}> · {track.album}</Text> : null}
            </Text>
          </View>

          <View style={styles.nowActionRow}>
            <Pressable
              style={styles.nowActionButton}
              onPress={togglePin}
              accessibilityRole="button"
              accessibilityLabel={isPinned ? 'Unpin from Home' : 'Pin to Home'}
            >
              <Star size={23} color="#FFFFFF" fill={isPinned ? '#FFFFFF' : 'transparent'} />
            </Pressable>
            <Pressable
              style={styles.nowMore}
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <MoreHorizontal size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <Slider
            value={status.currentTime}
            minimumValue={0}
            maximumValue={duration || 1}
            onSlidingComplete={seekTo}
            minimumTrackTintColor="#FFFFFF"
            maximumTrackTintColor="rgba(255,255,255,0.24)"
            thumbTintColor="#FFFFFF"
            style={styles.slider}
          />
          <View style={styles.nowTimeRow}>
            <Text style={styles.nowTime}>{formatTime(status.currentTime)}</Text>
            <Text style={styles.nowTime}>{formatTime(duration)}</Text>
          </View>

          <View style={styles.nowControls}>
            <Pressable style={styles.nowControl} onPress={skipPrevious} accessibilityRole="button" accessibilityLabel="Previous track">
              <SkipBack size={30} color="#FFFFFF" fill="#FFFFFF" />
            </Pressable>
            <PressableScale
              style={styles.nowPlay}
              onPress={togglePlayback}
              accessibilityRole="button"
              accessibilityLabel={status.playing ? 'Pause' : 'Play'}
            >
              {status.playing ? <Pause size={44} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={44} color="#FFFFFF" fill="#FFFFFF" />}
            </PressableScale>
            <Pressable style={styles.nowControl} onPress={skipNext} accessibilityRole="button" accessibilityLabel="Next track">
              <SkipForward size={30} color="#FFFFFF" fill="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.volumeRow}>
            <Volume2 size={15} color="rgba(255,255,255,0.5)" />
            <Slider
              value={volume}
              minimumValue={0}
              maximumValue={1}
              onValueChange={(value) => {
                setVolumeState(value);
                setVolume(value);
              }}
              minimumTrackTintColor="rgba(255,255,255,0.85)"
              maximumTrackTintColor="rgba(255,255,255,0.24)"
              thumbTintColor="#FFFFFF"
              style={styles.volumeSlider}
            />
            <Volume2 size={17} color="rgba(255,255,255,0.85)" />
          </View>

          <View style={styles.nowDock}>
            <Pressable
              style={styles.dockButton}
              onPress={() => useUi.getState().openLyrics(track)}
              accessibilityRole="button"
              accessibilityLabel="Lyrics"
            >
              <MessageCircle size={21} color="rgba(255,255,255,0.72)" />
            </Pressable>
            <Pressable
              style={styles.dockButton}
              onPress={() => setRepeat(cycleRepeat())}
              accessibilityRole="button"
              accessibilityLabel={`Repeat ${repeat === 'none' ? 'off' : repeat === 'all' ? 'queue' : 'one song'}`}
            >
              {repeat === 'single' ? (
                <Repeat1 size={21} color="#FFFFFF" />
              ) : (
                <Repeat size={21} color={repeat === 'all' ? '#FFFFFF' : 'rgba(255,255,255,0.72)'} />
              )}
              {repeat !== 'none' ? <View style={styles.dockDot} /> : null}
            </Pressable>
            <Pressable
              style={styles.dockButton}
              onPress={() => navigation.navigate('Queue')}
              accessibilityRole="button"
              accessibilityLabel="Up next"
            >
              <ListMusic size={21} color="rgba(255,255,255,0.72)" />
            </Pressable>
          </View>

          <NoticeToast text={notice} />
        </View>
      </SafeAreaView>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Close menu">
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuGrabber} />
            <Text style={styles.menuTitle} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={styles.menuSubtitle} numberOfLines={1}>
              {track.artist}
            </Text>
            <Pressable
              style={styles.menuRow}
              onPress={togglePin}
              accessibilityRole="button"
              accessibilityLabel={isPinned ? 'Unpin from Home' : 'Pin to Home'}
            >
              <Star size={18} color={colors.text} fill={isPinned ? colors.text : 'transparent'} />
              <Text style={styles.menuRowText}>{isPinned ? 'Unpin from Home' : 'Pin to Home'}</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                addToQueue(track);
                setMenuOpen(false);
                showNotice('Added to Up next');
              }}
              accessibilityRole="button"
            >
              <ListMusic size={18} color={colors.text} />
              <Text style={styles.menuRowText}>Add to Up next</Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuOpen(false);
                useUi.getState().openAddToPlaylist(track);
              }}
              accessibilityRole="button"
            >
              <Plus size={18} color={colors.text} />
              <Text style={styles.menuRowText}>Add to playlist</Text>
            </Pressable>
            <Pressable style={styles.menuRow} onPress={() => setMenuOpen(false)} accessibilityRole="button">
              <X size={18} color={colors.text} />
              <Text style={styles.menuRowText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function QueueScreen({ navigation }: any) {
  const queue = usePlayer((s) => s.queue);
  const status = useAudioPlaylistStatus(playlist);
  const [showAll, setShowAll] = useState(false);
  const current = queue[status.currentIndex];
  const upcoming = queue.slice(status.currentIndex + 1);
  const shown = showAll ? upcoming : upcoming.slice(0, 15);
  const minutes = Math.round(upcoming.reduce((sum, track) => sum + (track.duration || 0), 0) / 60);

  const saveAsPlaylist = () => {
    if (!queue.length) return;
    const id = useLibrary.getState().createPlaylist(`Queue · ${new Date().toLocaleDateString()}`, queue);
    navigation.navigate('Playlist', { id });
  };

  const confirmClear = () => {
    Alert.alert('Clear the queue?', `${queue.length} songs leave the queue. They stay in your library and playlists.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearQueue() },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close up next">
          <ChevronDown size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerLabel}>Up next</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.pageTitle}>Up next</Text>
        <Text style={styles.pageSubtitle}>The next 15 songs in order.</Text>

        {current ? (
          <>
            <Text style={styles.sectionLabel}>Playing</Text>
            <View style={styles.playingCard}>
              <Artwork source={current.artworkSmall || current.artwork} size={48} rounded={4} />
              <View style={styles.playingText}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {current.title}
                </Text>
                <Text style={styles.trackSubtitle} numberOfLines={1}>
                  {current.artist}
                </Text>
              </View>
              <Pressable style={styles.iconButton} onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Play'}>
                {status.playing ? <Pause size={18} color={colors.text} fill={colors.text} /> : <Play size={18} color={colors.text} fill={colors.text} />}
              </Pressable>
            </View>
          </>
        ) : null}

        {upcoming.length ? (
          <View style={styles.queueMetaRow}>
            <Text style={styles.sectionLabel}>
              Up next · {shown.length} of {upcoming.length}
            </Text>
            <Text style={styles.queueMeta}>{minutes} min total</Text>
          </View>
        ) : (
          <EmptyState>
            {current ? 'Nothing after this song. Add one from any track row.' : 'The queue is empty.'}
          </EmptyState>
        )}

        {shown.map((track, index) => (
          <TrackRow key={`${track.id}-${index}`} track={track} context={queue} index={status.currentIndex + 1 + index} compact />
        ))}

        {upcoming.length > 15 ? (
          <Pressable style={styles.linkButton} onPress={() => setShowAll((open) => !open)} accessibilityRole="button">
            <Text style={styles.linkText}>{showAll ? 'Show fewer' : `Show ${upcoming.length - 15} more`}</Text>
          </Pressable>
        ) : null}

        {queue.length ? (
          <View style={styles.pillRow}>
            <Pressable style={styles.ghostPill} onPress={saveAsPlaylist} accessibilityRole="button">
              <Text style={styles.ghostPillText}>Save as playlist</Text>
            </Pressable>
            <Pressable style={styles.ghostPill} onPress={confirmClear} accessibilityRole="button">
              <Trash2 size={14} color={colors.muted} />
              <Text style={styles.ghostPillText}>Clear queue</Text>
            </Pressable>
          </View>
        ) : null}
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
          tabBarStyle: {
            backgroundColor: 'rgba(16,16,20,0.94)',
            borderTopColor: 'rgba(255,255,255,0.10)',
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 64,
            paddingTop: 7,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 0.1, marginTop: 2 },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <Home size={21} color={color} /> }} />
        <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarIcon: ({ color }) => <Search size={21} color={color} /> }} />
        <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarIcon: ({ color }) => <Library size={21} color={color} /> }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color }) => <Cog size={21} color={color} /> }} />
      </Tab.Navigator>
      <MiniPlayer />
    </View>
  );
}

export default function App() {
  const libraryReady = useLibrary((s) => s.ready);
  const settingsReady = useSettings((s) => s.ready);
  const [fontsLoaded] = useFonts({
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
        <AmbientBackdrop />
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Playlist" component={PlaylistScreen} />
            <Stack.Screen name="Import" component={ImportScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="NowPlaying" component={NowPlayingScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Queue" component={QueueScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="Genre" component={GenreScreen} />
            <Stack.Screen name="Charts" component={ChartsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <AddToPlaylistSheet />
        <LyricsSheet />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

/** The cover fades and settles in whenever the track changes. */
function ArtSwap({ uri, size }: { uri?: string; size: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.03)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (reduce) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, reduce]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <Artwork source={uri} size={size} rounded={22} />
    </Animated.View>
  );
}

/** Confirmations slide up into place instead of blinking in. */
function NoticeToast({ text }: { text: string | null }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(10)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (!text) return;
    if (reduce) {
      opacity.setValue(1);
      shift.setValue(0);
      return;
    }
    opacity.setValue(0);
    shift.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [text, opacity, shift, reduce]);

  if (!text) return null;
  return (
    <Animated.View style={[styles.notice, { opacity, transform: [{ translateY: shift }] }]} pointerEvents="none">
      <Text style={styles.noticeText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },

  // --- shared page furniture ---------------------------------------------
  page: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 170 },
  pageTitle: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 30, letterSpacing: -1 },
  pageSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: colors.bg },
  muted: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13 },
  loadingText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13 },
  sectionLabel: { color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
  },
  trackTitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 14.5 },
  trackSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5, marginTop: 2 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  personText: { flex: 1, minWidth: 0 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 12,
  },
  secondaryButtonText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 13 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, alignItems: 'center' },
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
    borderRadius: 999,
    paddingVertical: 12,
  },
  actionButtonText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 12.5 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  headerLabel: { color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 13,
    marginBottom: 12,
  },
  playAllText: { color: colors.accentInk, fontFamily: fonts.sansBold, fontSize: 14 },
  fieldLabel: { color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 8 },
  fieldHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  resultCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12, gap: 6 },
  resultText: { color: colors.text, fontFamily: fonts.sans, fontSize: 13, lineHeight: 20 },
  resultStrong: { fontFamily: fonts.sansBold },
  importButton: { alignSelf: 'stretch', alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.4 },

  // --- home ---------------------------------------------------------------
  homePage: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 190 },
  glassPanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  homeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  wordmark: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 20, letterSpacing: -0.8 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderColor: colors.glassLine,
    borderWidth: 1,
  },
  heroTitle: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 36, letterSpacing: -1.6, marginTop: 10 },
  heroDate: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12.5, marginTop: 4, marginBottom: 4 },
  rail: { gap: 12, paddingRight: 18 },
  card: { width: 140, gap: 2 },
  cardTitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 7 },
  cardSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5 },
  artCard: { width: 148, gap: 2 },
  artCardArt: { width: 148, height: 148 },
  artCardPlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artCardTitle: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 13, marginTop: 8 },
  artCardSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5 },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  playPillText: { color: colors.accentInk, fontFamily: fonts.sansBold, fontSize: 12.5 },
  ghostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ghostPillText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 12.5 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 12 },
  mixMeta: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5, marginTop: 2, marginBottom: 2 },
  linkButton: { alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 10 },
  linkText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 12.5, textDecorationLine: 'underline' },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  chartRank: { width: 18, color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 12.5 },
  chartMeta: { flex: 1 },
  chartMetric: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreTile: {
    width: '100%',
    height: 84,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceRaised,
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
  },
  genreScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,11,0.46)' },
  genreName: { color: '#FFFFFF', fontFamily: fonts.sansBold, fontSize: 15, letterSpacing: -0.3, padding: 10 },
  inlineLoading: { paddingVertical: 24, alignItems: 'center' },

  // --- now playing -------------------------------------------------------
  nowStage: { flex: 1, backgroundColor: colors.stage },
  nowScrim: { backgroundColor: 'rgba(10,10,11,0.58)' },
  nowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4 },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  nowIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  nowBody: { flex: 1, paddingHorizontal: 22, paddingBottom: 4, gap: 10 },
  nowArtWrap: { flexGrow: 1, flexShrink: 1, minHeight: 140, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  nowText: { marginTop: 2 },
  nowTitle: { color: '#FFFFFF', fontFamily: fonts.sansBold, fontSize: 26, lineHeight: 31, letterSpacing: -0.9 },
  nowArtist: { marginTop: 3, fontFamily: fonts.sans, fontSize: 13.5 },
  nowArtistName: { color: 'rgba(255,255,255,0.86)', fontFamily: fonts.sansMedium },
  nowMeta: { color: 'rgba(255,255,255,0.55)' },
  nowActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -2, marginBottom: 2 },
  nowActionButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  nowMore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  slider: { width: '100%', height: 26, marginHorizontal: -6 },
  nowTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  nowTime: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.sans, fontSize: 11.5 },
  nowControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 2 },
  nowPlay: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  nowControl: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  volumeSlider: { flex: 1, height: 24 },
  nowDock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 4 },
  dockButton: { width: 52, height: 42, alignItems: 'center', justifyContent: 'center' },
  dockDot: { position: 'absolute', bottom: 4, width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  notice: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  noticeText: { color: '#0A0A0B', fontFamily: fonts.sansMedium, fontSize: 12.5 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 4,
  },
  menuGrabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 10 },
  menuTitle: { color: colors.text, fontFamily: fonts.sansBold, fontSize: 16, letterSpacing: -0.3 },
  menuSubtitle: { color: colors.muted, fontFamily: fonts.sans, fontSize: 12.5, marginBottom: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  menuRowText: { color: colors.text, fontFamily: fonts.sansMedium, fontSize: 14 },

  // --- queue -------------------------------------------------------------
  playingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 8,
    marginTop: 8,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
  },
  playingText: { flex: 1, minWidth: 0 },
  queueMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  queueMeta: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11.5 },
});
