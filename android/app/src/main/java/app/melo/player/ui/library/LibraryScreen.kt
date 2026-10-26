package app.melo.player.ui.library

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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.LibraryMusic
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.CreatePlaylistDialog
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.TrackRow
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class LibraryViewModel : ViewModel() {
    private val library = ServiceLocator.library

    val playlists = library.playlists.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val favorites = library.favorites.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val followed = library.followedArtists.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun create(name: String, onCreated: (Long) -> Unit) {
        viewModelScope.launch {
            onCreated(library.createPlaylist(name))
        }
    }

    companion object {
        val Factory = viewModelFactory { initializer { LibraryViewModel() } }
    }
}

private enum class Tab(val label: String) { PLAYLISTS("Playlists"), FAVOURITES("Favourites"), ARTISTS("Artists") }

@Composable
fun LibraryScreen(
    app: AppViewModel,
    onOpenPlaylist: (Long) -> Unit,
    onOpenArtist: (String) -> Unit,
    onOpenDownloads: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenImport: () -> Unit,
    onPlayTracks: (List<Track>, Int) -> Unit,
    vm: LibraryViewModel = viewModel(factory = LibraryViewModel.Factory),
) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val playlists by vm.playlists.collectAsStateWithLifecycle()
    val favorites by vm.favorites.collectAsStateWithLifecycle()
    val followed by vm.followed.collectAsStateWithLifecycle()
    val actions = LocalTrackActions.current
    var tab by remember { mutableStateOf(Tab.PLAYLISTS) }
    var showCreate by remember { mutableStateOf(false) }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            Text(
                "your library",
                style = MaterialTheme.typography.displayMedium,
                modifier = Modifier.padding(start = Spacing.screenH, top = Spacing.xl, bottom = Spacing.md),
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screenH),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                Shortcut(0.33f, "Downloads", Icons.Rounded.Download, onOpenDownloads)
                Shortcut(0.33f, "History", Icons.Rounded.History, onOpenHistory)
                Shortcut(0.33f, "Import", Icons.Rounded.CloudDownload, onOpenImport)
            }
            Spacer(Modifier.height(Spacing.md))

            Row(
                modifier = Modifier.padding(horizontal = Spacing.screenH),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                Tab.entries.forEach { t ->
                    val selected = t == tab
                    Text(
                        t.label,
                        style = MaterialTheme.typography.labelLarge,
                        color = if (selected) MaterialTheme.colorScheme.onPrimary else LocalMeloColors.current.textSecondary,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                if (selected) MaterialTheme.colorScheme.primary
                                else LocalMeloColors.current.surfaceElevated,
                            )
                            .clickable { tab = t }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                    )
                }
            }

            when (tab) {
                Tab.PLAYLISTS -> {
                    if (playlists.isEmpty()) {
                        EmptyState(
                            title = "No playlists yet",
                            message = "Create one, or add songs from anywhere with the ⋮ menu.",
                            icon = Icons.Rounded.LibraryMusic,
                            action = { NewPlaylistButton { showCreate = true } },
                        )
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            contentPadding = PaddingValues(Spacing.screenH),
                            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                            verticalArrangement = Arrangement.spacedBy(Spacing.md),
                        ) {
                            item(span = { GridItemSpan(2) }) {
                                NewPlaylistButton { showCreate = true }
                            }
                            items(playlists, key = { it.id }) { playlist ->
                                Column(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(16.dp))
                                        .clickable { onOpenPlaylist(playlist.id) },
                                ) {
                                    MeloArt(
                                        playlist.coverArtwork,
                                        Modifier.fillMaxWidth().height(150.dp),
                                        corner = MeloTheme.radius,
                                    )
                                    Spacer(Modifier.height(Spacing.sm))
                                    Text(
                                        playlist.name,
                                        style = MaterialTheme.typography.titleMedium,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        "${playlist.trackCount} tracks",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                    )
                                }
                            }
                        }
                    }
                }

                Tab.FAVOURITES -> {
                    if (favorites.isEmpty()) {
                        EmptyState(
                            title = "No favourites yet",
                            message = "Tap the heart on any song to keep it here.",
                            icon = Icons.Rounded.Favorite,
                        )
                    } else {
                        LazyColumn(Modifier.fillMaxSize()) {
                            item {
                                Row(
                                    Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        "${favorites.size} songs",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(
                                        "Play all",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.clickable { onPlayTracks(favorites, 0) },
                                    )
                                }
                            }
                            items(favorites, key = { it.key }) { track ->
                                TrackRow(
                                    track = track,
                                    isActive = playback.current?.key == track.key,
                                    onClick = { onPlayTracks(favorites, favorites.indexOf(track)) },
                                    trailing = { OverflowButton { actions.show(track) } },
                                )
                            }
                            item { Spacer(Modifier.height(90.dp)) }
                        }
                    }
                }

                Tab.ARTISTS -> {
                    if (followed.isEmpty()) {
                        EmptyState(
                            title = "Not following anyone",
                            message = "Follow artists to see them here and in your recommendations.",
                            icon = Icons.Rounded.Person,
                        )
                    } else {
                        LazyColumn(Modifier.fillMaxSize()) {
                            items(followed, key = { it.name }) { artist ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { onOpenArtist(artist.name) }
                                        .padding(horizontal = Spacing.screenH, vertical = 7.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    MeloArt(artist.artwork, Modifier.size(50.dp), circular = true)
                                    Spacer(Modifier.width(Spacing.md))
                                    Column {
                                        Text(artist.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                                        Text(
                                            "Artist",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = LocalMeloColors.current.textSecondary,
                                        )
                                    }
                                }
                            }
                            item { Spacer(Modifier.height(90.dp)) }
                        }
                    }
                }
            }
        }
    }

    if (showCreate) {
        CreatePlaylistDialog(
            onDismiss = { showCreate = false },
            onCreate = { name ->
                vm.create(name) { id -> onOpenPlaylist(id) }
                showCreate = false
            },
        )
    }
}

@Composable
private fun Shortcut(fraction: Float, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth(fraction)
            .clip(RoundedCornerShape(18.dp))
            .background(LocalMeloColors.current.surfaceElevated)
            .clickable(onClick = onClick)
            .padding(Spacing.md),
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(Spacing.sm))
        Text(label, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun NewPlaylistButton(onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
            .clickable(onClick = onClick)
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.width(Spacing.sm))
        Text("New playlist", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
    }
}
