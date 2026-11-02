package app.melo.player.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.List
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.ShowChart
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.melo.player.data.model.Artist
import app.melo.player.data.model.Album
import app.melo.player.data.model.HomeSection
import app.melo.player.data.model.Playlist
import app.melo.player.data.model.Track
import app.melo.player.data.prefs.Settings
import app.melo.player.di.ServiceLocator
import app.melo.player.playback.PlaybackState
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.brand.MeloMark
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.SectionHeader
import app.melo.player.ui.components.formatDuration
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface ProviderState {
    data object Loading : ProviderState
    data class Ready(val sections: List<HomeSection>) : ProviderState
    data class Failed(val message: String) : ProviderState
}

class HomeViewModel : ViewModel() {
    private val music = ServiceLocator.music
    private val library = ServiceLocator.library

    private val _provider = MutableStateFlow<ProviderState>(ProviderState.Loading)
    val provider: StateFlow<ProviderState> = _provider.asStateFlow()

    val history = library.history.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val mostPlayed = library.mostPlayed.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val playlists = library.playlists.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val followed = library.followedArtists.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val downloads = music.downloadedTracks().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _provider.value = ProviderState.Loading
            _provider.value = runCatching { music.providerSections() }
                .fold(
                    onSuccess = { ProviderState.Ready(it) },
                    onFailure = { ProviderState.Failed("Could not reach the catalog.") },
                )
        }
    }

    companion object {
        val Factory = viewModelFactory { initializer { HomeViewModel() } }
    }
}

data class HomeNav(
    val openSearch: () -> Unit,
    val openLibrary: () -> Unit,
    val openDownloads: () -> Unit,
    val openHistory: () -> Unit,
    val openPlaylists: () -> Unit,
    val openFollowed: () -> Unit,
    val openPlayer: () -> Unit,
    val openSettings: () -> Unit,
    val openAlbum: (Album) -> Unit,
    val openArtist: (String) -> Unit,
    val playList: (List<Track>, Int) -> Unit,
    val openPlaylist: (Long) -> Unit,
)

@Composable
fun HomeScreen(
    app: AppViewModel,
    onOpenTrack: (List<Track>, Int) -> Unit,
    onOpenAlbum: (Album) -> Unit,
    onOpenArtist: (String) -> Unit,
    onOpenPlaylist: (Long) -> Unit,
    onOpenPlayer: () -> Unit,
    onOpenSettings: () -> Unit,
    vm: HomeViewModel = viewModel(factory = HomeViewModel.Factory),
) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val provider by vm.provider.collectAsStateWithLifecycle()
    val history by vm.history.collectAsStateWithLifecycle()
    val mostPlayed by vm.mostPlayed.collectAsStateWithLifecycle()
    val playlists by vm.playlists.collectAsStateWithLifecycle()
    val followed by vm.followed.collectAsStateWithLifecycle()
    val downloads by vm.downloads.collectAsStateWithLifecycle()

    val nav = HomeNav(
        openSearch = { /* open search — wire when ready */ },
        openLibrary = { /* open library tab — wire when ready */ },
        openDownloads = { /* open downloads — wire when ready */ },
        openHistory = { /* open history — wire when ready */ },
        openPlaylists = { /* open playlists list — wire when ready */ },
        openFollowed = { /* open followed artists — wire when ready */ },
        openPlayer = onOpenPlayer,
        openSettings = onOpenSettings,
        openAlbum = onOpenAlbum,
        openArtist = onOpenArtist,
        playList = onOpenTrack,
        openPlaylist = onOpenPlaylist,
    )

    val greeting = greetingForNow()

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 28.dp),
        ) {
            item { GreetingRow(settings, greeting, playback, nav) }

            item { ShortcutsGrid(nav) }

            if (downloads.isNotEmpty()) {
                item { SectionHeader("Downloaded", "Ready without a connection", onAction = { /* open downloads */ }) }
                item { TracksRow(downloads, nav) }
            }

            if (mostPlayed.isNotEmpty()) {
                item { SectionHeader("Most listened", "From your own listening") }
                item { TracksRow(mostPlayed.map { it.first }, nav) }
            }

            if (history.isNotEmpty()) {
                item { SectionHeader("Recently played", "Pick up where you left off") }
                item { TracksRow(history.take(14), nav) }
            }

            if (playlists.isNotEmpty()) {
                item { SectionHeader("Your playlists", "${playlists.size} collections") }
                item { PlaylistsRow(playlists, nav) }
            }

            if (followed.isNotEmpty()) {
                item { SectionHeader("Followed artists", "People you follow") }
                item { ArtistsRow(followed, nav) }
            }

            when (val state = provider) {
                is ProviderState.Loading -> item { LoadingRow("Finding music for you") }
                is ProviderState.Failed -> item {
                    EmptyState(
                        title = "Catalog unreachable",
                        message = state.message + " Your library and downloads still work.",
                        action = { TextButton("Retry", { vm.refresh() }) },
                    )
                }
                is ProviderState.Ready -> {
                    if (state.sections.isEmpty() && history.isEmpty() && playlists.isEmpty()) {
                        item { EmptyState(title = "Nothing here yet", message = "Play something and melo will start building your home.") }
                    }
                    state.sections.forEach { section ->
                        item(key = "header-${section.id}") { SectionHeader(section.title, section.subtitle.takeIf { it.isNotBlank() }) }
                        item(key = "row-${section.id}") {
                            when (section.kind) {
                                HomeSection.Kind.TRACKS -> TracksRow(section.tracks, nav)
                                HomeSection.Kind.ALBUMS -> EmptyState(title = "Albums", message = "Not available yet.")
                                HomeSection.Kind.ARTISTS -> ArtistsRow(section.artists, nav)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GreetingRow(settings: Settings, greeting: String, playback: PlaybackState, nav: HomeNav) {
    val colors = LocalMeloColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screenH, vertical = Spacing.md)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f))
            .padding(Spacing.md),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            MeloMark(variantId = settings.logoId, size = 32.dp, modifier = Modifier.padding(end = Spacing.sm))
            Spacer(Modifier.width(Spacing.xs))
            Text("melo", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.weight(1f))
            IconButton(onClick = nav.openSettings) {
                Icon(Icons.Rounded.Settings, contentDescription = "Settings", tint = colors.textSecondary)
            }
        }
        Spacer(Modifier.height(Spacing.sm))
        Text(greeting, style = MaterialTheme.typography.displaySmall, color = colors.textPrimary)
        Text(
            if (playback.current != null) "Listening to ${playback.current!!.artist}" else "Something quiet, something loud.",
            style = MaterialTheme.typography.bodyMedium,
            color = colors.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ShortcutsGrid(nav: HomeNav) {
    val shortcuts = listOf(
        ShortcutItem(Icons.Rounded.ShowChart, "Downloads", "Saved offline"),
        ShortcutItem(Icons.Rounded.History, "Listening history", "Pick up where you left off"),
        ShortcutItem(Icons.Rounded.List, "Playlists", "Your collections"),
        ShortcutItem(Icons.Rounded.Person, "Followed artists", "People you follow"),
        ShortcutItem(Icons.Rounded.LibraryMusic, "Your library", "Albums, artists"),
        ShortcutItem(Icons.Rounded.Settings, "Settings", "App preferences"),
    )
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH, vertical = Spacing.sm)) {
        Text("Browse all", style = MaterialTheme.typography.titleMedium, color = LocalMeloColors.current.textPrimary)
        Spacer(Modifier.height(Spacing.sm))
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(horizontal = Spacing.xs),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
            modifier = Modifier.heightIn(max = 360.dp),
        ) {
            items(shortcuts) { shortcut ->
                ShortcutTile(shortcut.icon, shortcut.label, shortcut.sub)
            }
        }
    }
}

private data class ShortcutItem(
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val label: String,
    val sub: String?,
)

@Composable
private fun ShortcutTile(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, sub: String?) {
    val colors = LocalMeloColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.surfaceElevated)
            .clickable { }
            .padding(Spacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = label, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp))
        Spacer(Modifier.height(Spacing.sm))
        Text(label, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (!sub.isNullOrBlank()) {
            Text(sub, style = MaterialTheme.typography.bodySmall, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        }
    }
}

@Composable
private fun TracksRow(tracks: List<Track>, nav: HomeNav) {
    if (tracks.isEmpty()) return
    LazyRow(
        contentPadding = PaddingValues(horizontal = Spacing.screenH),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        items(tracks, key = { it.key }) { track ->
            TrackCard(track) { nav.playList(tracks, tracks.indexOf(track)) }
        }
    }
}

@Composable
private fun TrackCard(track: Track, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(132.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
    ) {
        MeloArt(track.artwork, Modifier.size(132.dp), corner = 12.dp)
        Spacer(Modifier.height(Spacing.sm))
        Text(track.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(track.artist, style = MaterialTheme.typography.bodySmall, color = LocalMeloColors.current.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun PlaylistsRow(playlists: List<Playlist>, nav: HomeNav) {
    if (playlists.isEmpty()) return
    LazyRow(
        contentPadding = PaddingValues(horizontal = Spacing.screenH),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        items(playlists, key = { it.id }) { playlist ->
            PlaylistCard(playlist) { nav.openPlaylist(playlist.id) }
        }
    }
}

@Composable
private fun PlaylistCard(playlist: Playlist, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(132.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
    ) {
        MeloArt(playlist.coverArtwork, modifier = Modifier.size(132.dp), corner = 12.dp)
        Spacer(Modifier.height(Spacing.sm))
        Text(playlist.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("${playlist.trackCount} tracks", style = MaterialTheme.typography.bodySmall, color = LocalMeloColors.current.textSecondary)
    }
}

@Composable
private fun ArtistsRow(artists: List<Artist>, nav: HomeNav) {
    if (artists.isEmpty()) return
    LazyRow(
        contentPadding = PaddingValues(horizontal = Spacing.screenH),
        horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        items(artists, key = { it.name }) { artist ->
            ArtistCard(artist) { nav.openArtist(artist.name) }
        }
    }
}

@Composable
private fun ArtistCard(artist: Artist, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(92.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        MeloArt(artist.artwork, modifier = Modifier.size(84.dp), corner = 84.dp)
        Spacer(Modifier.height(Spacing.sm))
        Text(artist.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun LoadingRow(label: String) {
    Text(label, style = MaterialTheme.typography.bodyMedium, color = LocalMeloColors.current.textSecondary)
}

@Composable
private fun EmptyState(title: String, message: String, action: @Composable (() -> Unit)? = null) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = LocalMeloColors.current.textPrimary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Text(message, style = MaterialTheme.typography.bodySmall, color = LocalMeloColors.current.textSecondary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        if (action != null) { Spacer(Modifier.height(Spacing.xs)); action() }
    }
}

@Composable
private fun TextButton(label: String, onClick: () -> Unit) {
    Text(label, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 9.dp))
}

private fun greetingForNow(): String {
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when (hour) {
        in 5..11 -> "good morning"
        in 12..17 -> "good afternoon"
        in 18..22 -> "good evening"
        else -> "late night"
    }
}
