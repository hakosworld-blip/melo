package app.melo.player.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.melo.player.data.model.Album
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.playback.PlaybackState
import app.melo.player.ui.components.LocalCurrentTrack
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.TrackActionsHost
import app.melo.player.ui.components.TrackActionsState
import app.melo.player.ui.detail.AlbumScreen
import app.melo.player.ui.detail.ArtistScreen
import app.melo.player.ui.detail.PlaylistScreen
import app.melo.player.ui.detail.ProviderPlaylistScreen
import app.melo.player.ui.home.HomeScreen
import app.melo.player.ui.library.DownloadsScreen
import app.melo.player.ui.library.HistoryScreen
import app.melo.player.ui.library.ImportScreen
import app.melo.player.ui.library.LibraryScreen
import app.melo.player.ui.lyrics.LyricsScreen
import app.melo.player.ui.player.NowPlayingScreen
import app.melo.player.ui.player.QueueScreen
import app.melo.player.ui.search.SearchScreen
import app.melo.player.ui.settings.SettingsScreen
import app.melo.player.ui.settings.StorageScreen
import app.melo.player.ui.shadcn.Icon
import app.melo.player.ui.shadcn.MeloProgress
import app.melo.player.ui.shadcn.MeloScaffold
import app.melo.player.ui.shadcn.MeloToastHost
import app.melo.player.ui.shadcn.MeloToastState
import app.melo.player.ui.shadcn.Text
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

@Composable
fun MeloRoot(
    app: AppViewModel,
    onRequestNotificationPermission: () -> Unit,
) {
    val nav = rememberNavController()
    val backStackEntry by nav.currentBackStackEntryAsState()
    val route = backStackEntry?.destination?.route
    val playbackState by app.playback.state.collectAsStateWithLifecycle()
    val snackbar = remember { MeloToastState() }
    val scope = rememberCoroutineScope()

    val chromeRoutes = setOf(Routes.HOME, Routes.SEARCH, Routes.LIBRARY)
    val showChrome = route in chromeRoutes

    val actions = remember(app.playback) {
        TrackActionsState(
            playback = app.playback,
            onOpenArtist = { nav.navigate(Routes.artist(it)) },
            onOpenAlbum = { track ->
                if (track.album.isNotBlank()) {
                    nav.navigate(
                        Routes.album(
                            Album(id = "", title = track.album, artist = track.artist, artwork = track.artwork),
                        ),
                    )
                } else {
                    nav.navigate(Routes.artist(track.artist))
                }
            },
            notify = { message -> scope.launch { snackbar.show(message) } },
        )
    }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onRequestNotificationPermission()
        }
    }

    LaunchedEffect(playbackState.error) {
        playbackState.error?.let {
            snackbar.show(it)
            app.clearError()
        }
    }

    CompositionLocalProvider(
        LocalTrackActions provides actions,
        LocalCurrentTrack provides playbackState.current,
    ) {
        MeloScaffold(
            containerColor = Color.Transparent,
            snackbarHost = { MeloToastHost(snackbar) },
            bottomBar = {
                if (showChrome) {
                    Column {
                        MiniPlayer(
                            state = playbackState,
                            position = app.playback.position,
                            onOpen = { nav.navigateSingleTop(Routes.PLAYER) },
                            onToggle = { app.playback.toggle() },
                        )
                        MeloNavBar(current = route, nav = nav)
                    }
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize()) {
                NavHost(
                    navController = nav,
                    startDestination = Routes.HOME,
                    modifier = Modifier.padding(padding),
                    enterTransition = { fadeIn(tween(180)) },
                    exitTransition = { fadeOut(tween(140)) },
                ) {
                    composable(Routes.HOME) {
                        HomeScreen(
                            app = app,
                            onOpenTrack = { list, index -> app.playback.play(list, index) },
                            onOpenAlbum = { nav.navigate(Routes.album(it)) },
                            onOpenArtist = { nav.navigate(Routes.artist(it)) },
                            onOpenPlaylist = { nav.navigate(Routes.playlist(it)) },
                            onOpenPlayer = { nav.navigateSingleTop(Routes.PLAYER) },
                            onOpenSettings = { nav.navigate(Routes.SETTINGS) },
                        )
                    }
                    composable(Routes.SEARCH) {
                        SearchScreen(
                            app = app,
                            onOpenTrack = { list, index -> app.playback.play(list, index) },
                            onOpenAlbum = { nav.navigate(Routes.album(it)) },
                            onOpenArtist = { nav.navigate(Routes.artist(it)) },
                            onOpenProviderPlaylist = { nav.navigate(Routes.providerPlaylist(it)) },
                        )
                    }
                    composable(Routes.LIBRARY) {
                        LibraryScreen(
                            app = app,
                            onOpenPlaylist = { nav.navigate(Routes.playlist(it)) },
                            onOpenArtist = { nav.navigate(Routes.artist(it)) },
                            onOpenDownloads = { nav.navigate(Routes.DOWNLOADS) },
                            onOpenHistory = { nav.navigate(Routes.HISTORY) },
                            onOpenImport = { nav.navigate(Routes.IMPORT) },
                            onPlayTracks = { list, index -> app.playback.play(list, index) },
                        )
                    }
                    composable(Routes.PLAYER) {
                        NowPlayingScreen(
                            app = app,
                            onClose = { nav.popBackStack() },
                            onOpenLyrics = { nav.navigate(Routes.LYRICS) },
                            onOpenQueue = { nav.navigate(Routes.QUEUE) },
                            onOpenArtist = { nav.navigate(Routes.artist(it)) },
                            onOpenAlbum = { track: Track ->
                                nav.navigate(
                                    Routes.album(Album(id = "", title = track.album, artist = track.artist, artwork = track.artwork)),
                                )
                            },
                        )
                    }
                    composable(
                        Routes.LYRICS,
                        enterTransition = { slideInVertically(tween(260)) { it / 6 } + fadeIn(tween(220)) },
                        exitTransition = { slideOutVertically(tween(200)) { it / 6 } + fadeOut(tween(160)) },
                    ) {
                        LyricsScreen(app = app, onClose = { nav.popBackStack() })
                    }
                    composable(Routes.QUEUE) {
                        QueueScreen(app = app, onClose = { nav.popBackStack() })
                    }
                    composable(
                        Routes.ARTIST,
                        arguments = listOf(navArgument("name") { type = NavType.StringType }),
                    ) { entry ->
                        val name = Payloads.text(entry.arguments?.getString("name").orEmpty()).orEmpty()
                        ArtistScreen(
                            name = name,
                            onBack = { nav.popBackStack() },
                            onOpenAlbum = { nav.navigate(Routes.album(it)) },
                            onOpenArtist = { nav.navigate(Routes.artist(it)) },
                            onPlay = { list, index -> app.playback.play(list, index) },
                        )
                    }
                    composable(
                        Routes.ALBUM,
                        arguments = listOf(navArgument("payload") { type = NavType.StringType }),
                    ) { entry ->
                        val album = Payloads.album(entry.arguments?.getString("payload").orEmpty())
                        if (album != null) {
                            AlbumScreen(
                                album = album,
                                onBack = { nav.popBackStack() },
                                onPlay = { list, index -> app.playback.play(list, index) },
                                onOpenArtist = { nav.navigate(Routes.artist(it)) },
                            )
                        }
                    }
                    composable(
                        Routes.PLAYLIST,
                        arguments = listOf(navArgument("id") { type = NavType.LongType }),
                    ) { entry ->
                        PlaylistScreen(
                            playlistId = entry.arguments?.getLong("id") ?: 0L,
                            onBack = { nav.popBackStack() },
                            onPlay = { list, index -> app.playback.play(list, index) },
                            onOpenArtist = { nav.navigate(Routes.artist(it)) },
                        )
                    }
                    composable(
                        Routes.PROVIDER_PLAYLIST,
                        arguments = listOf(navArgument("payload") { type = NavType.StringType }),
                    ) { entry ->
                        val playlist = Payloads.playlist(entry.arguments?.getString("payload").orEmpty())
                        ProviderPlaylistScreen(
                            playlist = playlist,
                            onBack = { nav.popBackStack() },
                            onPlay = { list, index -> app.playback.play(list, index) },
                        )
                    }
                    composable(Routes.DOWNLOADS) {
                        DownloadsScreen(app = app, onBack = { nav.popBackStack() }, onPlay = { list, i -> app.playback.play(list, i) })
                    }
                    composable(Routes.HISTORY) {
                        HistoryScreen(app = app, onBack = { nav.popBackStack() }, onPlay = { list, i -> app.playback.play(list, i) })
                    }
                    composable(Routes.IMPORT) {
                        ImportScreen(
                            app = app,
                            onBack = { nav.popBackStack() },
                            onOpenPlaylist = { id ->
                                nav.popBackStack()
                                nav.navigate(Routes.playlist(id))
                            },
                        )
                    }
                    composable(Routes.SETTINGS) {
                        SettingsScreen(
                            app = app,
                            onBack = { nav.popBackStack() },
                            onOpenStorage = { nav.navigate(Routes.STORAGE) },
                        )
                    }
                    composable(Routes.STORAGE) {
                        StorageScreen(
                            app = app,
                            onBack = { nav.popBackStack() },
                            notify = { message -> scope.launch { snackbar.show(message) } },
                        )
                    }
                }
            }
        }
        TrackActionsHost(actions)
    }
}

private fun NavHostController.navigateSingleTop(route: String) {
    navigate(route) { launchSingleTop = true }
}

@Composable
private fun MiniPlayer(
    state: PlaybackState,
    position: StateFlow<Long>,
    onOpen: () -> Unit,
    onToggle: () -> Unit,
) {
    val track = state.current ?: return
    val colors = LocalMeloColors.current
    val positionMs = position.collectAsStateWithLifecycle()
    Column(Modifier.navigationBarsPadding().padding(horizontal = 8.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(colors.surfaceElevated)
                .clickable(onClick = onOpen)
                .padding(8.dp),
        ) {
            MeloProgress(
                progress = if (state.durationMs > 0) (positionMs.value.toFloat() / state.durationMs).coerceIn(0f, 1f) else 0f,
                modifier = Modifier.fillMaxWidth(),
                color = MeloTheme.scheme.primary,
            )
            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MeloArt(track.artwork, Modifier.size(40.dp), corner = 8.dp)
                Spacer(Modifier.width(Spacing.md))
                Column(Modifier.weight(1f)) {
                    Text(
                        track.title,
                        style = MeloTheme.type.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = colors.textPrimary,
                    )
                    Text(
                        track.artist,
                        style = MeloTheme.type.bodySmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = colors.textSecondary,
                    )
                }
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(MeloTheme.scheme.primary)
                        .clickable(onClick = onToggle),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                        contentDescription = if (state.isPlaying) "Pause" else "Play",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun MeloNavBar(current: String?, nav: NavHostController) {
    val items = listOf(
        Triple(Routes.HOME, "Home", Icons.Rounded.Home),
        Triple(Routes.SEARCH, "Search", Icons.Rounded.Search),
        Triple(Routes.LIBRARY, "Library", Icons.Rounded.LibraryMusic),
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items.forEach { (route, label, icon) ->
            val selected = current == route
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(MeloTheme.radiusScale.md))
                    .background(if (selected) MeloTheme.scheme.secondary else Color.Transparent)
                    .clickable {
                        nav.navigate(route) {
                            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                    .padding(vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Icon(
                    icon,
                    contentDescription = label,
                    modifier = Modifier.size(18.dp),
                    tint = if (selected) MeloTheme.scheme.primary else LocalMeloColors.current.textSecondary,
                )
                Text(
                    label,
                    style = MeloTheme.type.labelSmall,
                    color = if (selected) MeloTheme.scheme.primary else LocalMeloColors.current.textSecondary,
                )
            }
        }
    }
}
