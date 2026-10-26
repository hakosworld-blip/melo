package app.melo.player.ui.detail

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDownward
import androidx.compose.material.icons.rounded.ArrowUpward
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.components.CircleIconButton
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.CreatePlaylistDialog
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.components.TrackRow
import app.melo.player.ui.components.formatDuration
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.launch

@Composable
fun PlaylistScreen(
    playlistId: Long,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onOpenArtist: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val library = ServiceLocator.library
    val playlist by library.playlist(playlistId).collectAsStateWithLifecycle(initialValue = null)
    val tracks by library.playlistTracks(playlistId).collectAsStateWithLifecycle(initialValue = emptyList())
    val current = app.melo.player.ui.components.LocalCurrentTrack.current
    val actions = LocalTrackActions.current

    var menuOpen by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }

    val totalDuration = tracks.sumOf { it.durationMs }

    Column(Modifier.fillMaxSize()) {
        ScreenHeader(
            playlist?.name ?: "Playlist",
            onBack = onBack,
            subtitle = "${tracks.size} tracks · ${formatDuration(totalDuration)}",
            trailing = {
                Box {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Rounded.MoreVert, contentDescription = "Playlist options")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(text = { Text("Rename") }, onClick = {
                            menuOpen = false
                            renaming = true
                        })
                        DropdownMenuItem(text = { Text("Reorder / remove tracks") }, onClick = {
                            menuOpen = false
                            editing = !editing
                        })
                        DropdownMenuItem(
                            text = { Text("Download all") },
                            onClick = {
                                menuOpen = false
                                scope.launch {
                                    tracks.forEach { ServiceLocator.downloads.enqueue(it) }
                                }
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Queue all") },
                            onClick = {
                                menuOpen = false
                                onPlay(tracks.drop(1), 0)
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Delete playlist", color = MaterialTheme.colorScheme.error) },
                            onClick = {
                                menuOpen = false
                                confirmDelete = true
                            },
                        )
                    }
                }
            },
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.screenH),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MeloArt(
                playlist?.coverArtwork.orEmpty(),
                Modifier.size(112.dp),
                corner = MeloTheme.radius,
            )
            Spacer(Modifier.width(Spacing.lg))
            Column(Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    RoundButton(Icons.Rounded.PlayArrow, "Play playlist", primary = true) {
                        if (tracks.isNotEmpty()) onPlay(tracks, 0)
                    }
                    RoundButton(Icons.Rounded.Shuffle, "Shuffle playlist") {
                        if (tracks.isNotEmpty()) onPlay(tracks.shuffled(), 0)
                    }
                }
                Spacer(Modifier.height(Spacing.sm))
                if (tracks.isNotEmpty()) {
                    MeloTextButton("Download all") {
                        scope.launch { tracks.forEach { ServiceLocator.downloads.enqueue(it) } }
                    }
                }
            }
        }

        Spacer(Modifier.height(Spacing.sm))

        if (tracks.isEmpty()) {
            EmptyState(
                title = "Empty playlist",
                message = "Add songs from search, your library or any song's menu.",
            )
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                itemsIndexed(tracks, key = { _, t -> t.key }) { index, track ->
                    TrackRow(
                        track = track,
                        isActive = current?.key == track.key,
                        onClick = { onPlay(tracks, index) },
                        leading = {
                            Text(
                                "${index + 1}",
                                style = MaterialTheme.typography.bodySmall,
                                color = LocalMeloColors.current.textSecondary,
                            )
                        },
                        trailing = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (editing) {
                                    CircleIconButton(Icons.Rounded.ArrowUpward, "Move up") {
                                        scope.launch {
                                            if (index > 0) library.moveTrack(playlistId, index, index - 1)
                                        }
                                    }
                                    CircleIconButton(Icons.Rounded.ArrowDownward, "Move down") {
                                        scope.launch {
                                            if (index < tracks.lastIndex) library.moveTrack(playlistId, index, index + 1)
                                        }
                                    }
                                    CircleIconButton(Icons.Rounded.Delete, "Remove track") {
                                        scope.launch { library.removeFromPlaylist(playlistId, track.key) }
                                    }
                                } else {
                                    OverflowButton { actions.show(track) }
                                }
                            }
                        },
                    )
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }

    if (renaming && playlist != null) {
        CreatePlaylistDialog(
            title = "Rename playlist",
            initialName = playlist!!.name,
            onDismiss = { renaming = false },
            onCreate = { name ->
                scope.launch { library.renamePlaylist(playlistId, name) }
                renaming = false
            },
        )
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Delete playlist?",
            message = "\"${playlist?.name ?: "This playlist"}\" and its ${tracks.size} tracks will be removed. The songs themselves stay in the catalog.",
            onConfirm = {
                scope.launch {
                    library.deletePlaylist(playlistId)
                    onBack()
                }
            },
            onDismiss = { confirmDelete = false },
        )
    }
}

@Composable
internal fun RoundButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    primary: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(if (primary) 52.dp else 44.dp)
            .clip(RoundedCornerShape(50))
            .background(
                if (primary) MaterialTheme.colorScheme.primary
                else LocalMeloColors.current.surfaceElevated,
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = description,
            tint = if (primary) MaterialTheme.colorScheme.onPrimary else LocalMeloColors.current.textPrimary,
            modifier = Modifier.size(if (primary) 24.dp else 20.dp),
        )
    }
}
