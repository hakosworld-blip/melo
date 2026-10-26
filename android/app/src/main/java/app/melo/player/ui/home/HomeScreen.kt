package app.melo.player.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
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
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LoadingRow
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.SectionHeader
import app.melo.player.ui.components.formatDuration
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloTheme
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
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = Spacing.screenH, end = 6.dp, top = Spacing.xl, bottom = Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            greeting,
                            style = MaterialTheme.typography.displayMedium,
                            color = LocalMeloColors.current.textPrimary,
                        )
                        Text(
                            if (playback.current != null) "Listening to ${playback.current!!.artist}"
                            else "Something quiet, something loud.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = LocalMeloColors.current.textSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    IconButton(onClick = { vm.refresh() }) {
                        Icon(
                            Icons.Rounded.Refresh,
                            contentDescription = "Refresh recommendations",
                            tint = LocalMeloColors.current.textSecondary,
                        )
                    }
                    IconButton(onClick = onOpenSettings) {
                        Icon(
                            Icons.Rounded.Settings,
                            contentDescription = "Settings",
                            tint = LocalMeloColors.current.textSecondary,
                        )
                    }
                }
            }

            // Continue listening
            playback.current?.let { current ->
                item {
                    ContinueCard(
                        track = current,
                        isPlaying = playback.isPlaying,
                        positionMs = playback.positionMs,
                        onPlay = { onOpenPlayer() },
                    )
                }
            }

            if (downloads.isNotEmpty()) {
                item {
                    SectionHeader("Downloaded", "Ready without a connection")
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = Spacing.screenH),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                    ) {
                        items(downloads.take(12), key = { it.key }) { track ->
                            TrackCard(track) {
                                onOpenTrack(downloads, downloads.indexOf(track))
                            }
                        }
                    }
                }
            }

            if (mostPlayed.isNotEmpty()) {
                item { SectionHeader("Most listened", "From your own listening") }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = Spacing.screenH),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                    ) {
                        items(mostPlayed.take(12), key = { it.first.key }) { (track, plays) ->
                            TrackCard(track, badge = "$plays plays") {
                                onOpenTrack(mostPlayed.map { it.first }, mostPlayed.indexOfFirst { it.first.key == track.key })
                            }
                        }
                    }
                }
            }

            if (history.isNotEmpty()) {
                item { SectionHeader("Recently played", "Pick up where you left off") }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = Spacing.screenH),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                    ) {
                        items(history.take(14), key = { it.key }) { track ->
                            TrackCard(track) {
                                onOpenTrack(history.take(14), history.take(14).indexOf(track))
                            }
                        }
                    }
                }
            }

            if (playlists.isNotEmpty()) {
                item { SectionHeader("Your playlists", "${playlists.size} collections") }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = Spacing.screenH),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                    ) {
                        items(playlists, key = { it.id }) { playlist ->
                            PlaylistCard(playlist) { onOpenPlaylist(playlist.id) }
                        }
                    }
                }
            }

            if (followed.isNotEmpty()) {
                item { SectionHeader("Artists you follow", "Followed by you") }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = Spacing.screenH),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
                    ) {
                        items(followed, key = { it.name }) { artist ->
                            ArtistBubble(artist) { onOpenArtist(artist.name) }
                        }
                    }
                }
            }

            when (val state = provider) {
                is ProviderState.Loading -> item { LoadingRow("Finding music for you") }
                is ProviderState.Failed -> item {
                    EmptyState(
                        title = "Catalog unreachable",
                        message = state.message + " Your library and downloads still work.",
                        action = { MeloTextButton("Retry", { vm.refresh() }) },
                    )
                }
                is ProviderState.Ready -> {
                    if (state.sections.isEmpty() && history.isEmpty() && playlists.isEmpty()) {
                        item {
                            EmptyState(
                                title = "Nothing here yet",
                                message = "Play something and melo will start building your home.",
                            )
                        }
                    }
                    state.sections.forEach { section ->
                        item(key = "header-${section.id}") {
                            SectionHeader(
                                title = section.title,
                                subtitle = section.subtitle.takeIf { it.isNotBlank() },
                            )
                        }
                        item(key = "row-${section.id}") {
                            when (section.kind) {
                                HomeSection.Kind.TRACKS -> LazyRow(
                                    contentPadding = PaddingValues(horizontal = Spacing.screenH),
                                    horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                                ) {
                                    items(section.tracks, key = { it.key }) { track ->
                                        TrackCard(track) {
                                            onOpenTrack(section.tracks, section.tracks.indexOf(track))
                                        }
                                    }
                                }
                                HomeSection.Kind.ALBUMS -> LazyRow(
                                    contentPadding = PaddingValues(horizontal = Spacing.screenH),
                                    horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                                ) {
                                    items(section.albums, key = { it.id + it.title }) { album ->
                                        AlbumCard(album) { onOpenAlbum(album) }
                                    }
                                }
                                HomeSection.Kind.ARTISTS -> LazyRow(
                                    contentPadding = PaddingValues(horizontal = Spacing.screenH),
                                    horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
                                ) {
                                    items(section.artists, key = { it.name }) { artist ->
                                        ArtistBubble(artist) { onOpenArtist(artist.name) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
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

@Composable
private fun ContinueCard(
    track: Track,
    isPlaying: Boolean,
    positionMs: Long,
    onPlay: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screenH, vertical = Spacing.sm)
            .clip(RoundedCornerShape(22.dp))
            .clickable(onClick = onPlay)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MeloArt(track.artwork, Modifier.size(66.dp), corner = 16.dp)
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Text("Continue listening", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            Text(
                track.title,
                style = MaterialTheme.typography.titleLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${track.artist} · ${formatDuration(positionMs)} / ${formatDuration(track.durationMs)}",
                style = MaterialTheme.typography.bodySmall,
                color = LocalMeloColors.current.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Rounded.PlayArrow,
                contentDescription = if (isPlaying) "Open player" else "Resume",
                tint = MaterialTheme.colorScheme.onPrimary,
            )
        }
    }
}

@Composable
private fun TrackCard(track: Track, badge: String? = null, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(132.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
    ) {
        MeloArt(track.artwork, Modifier.size(132.dp), corner = MeloTheme.radius)
        Spacer(Modifier.height(Spacing.sm))
        Text(
            track.title,
            style = MaterialTheme.typography.titleMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            badge ?: track.artist,
            style = MaterialTheme.typography.bodySmall,
            color = LocalMeloColors.current.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun AlbumCard(album: Album, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(148.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
    ) {
        MeloArt(album.artwork, Modifier.size(148.dp), corner = MeloTheme.radius)
        Spacer(Modifier.height(Spacing.sm))
        Text(
            album.title,
            style = MaterialTheme.typography.titleMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            album.artist,
            style = MaterialTheme.typography.bodySmall,
            color = LocalMeloColors.current.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ArtistBubble(artist: Artist, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(92.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        MeloArt(artist.artwork, Modifier.size(84.dp), circular = true, contentDescription = "${artist.name} artwork")
        Spacer(Modifier.height(Spacing.sm))
        Text(
            artist.name,
            style = MaterialTheme.typography.bodyMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun PlaylistCard(playlist: Playlist, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(132.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
    ) {
        MeloArt(playlist.coverArtwork, Modifier.size(132.dp), corner = MeloTheme.radius)
        Spacer(Modifier.height(Spacing.sm))
        Text(playlist.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            "${playlist.trackCount} tracks",
            style = MaterialTheme.typography.bodySmall,
            color = LocalMeloColors.current.textSecondary,
        )
    }
}

