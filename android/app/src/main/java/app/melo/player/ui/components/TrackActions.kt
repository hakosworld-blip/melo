package app.melo.player.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Album
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.QueueMusic
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.melo.player.data.model.Playlist
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.playback.PlaybackController
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * One overflow sheet for every track in the app.
 *
 * Screens only call [show]; the sheet, the playlist picker and the "new playlist"
 * dialog live here so the behaviour (and the snackbar wording) stays identical
 * everywhere.
 */
class TrackActionsState(
    private val playback: PlaybackController,
    private val onOpenArtist: (String) -> Unit,
    private val onOpenAlbum: (Track) -> Unit,
    private val notify: (String) -> Unit,
) {
    var track by mutableStateOf<Track?>(null)
        private set
    var showPlaylistPicker by mutableStateOf(false)
        private set
    var createForPlaylist by mutableStateOf(false)
        private set

    private var scope: kotlinx.coroutines.CoroutineScope? = null

    fun attach(scope: kotlinx.coroutines.CoroutineScope) {
        this.scope = scope
    }

    fun show(t: Track) {
        track = t
    }

    fun dismiss() {
        track = null
        showPlaylistPicker = false
        createForPlaylist = false
    }

    fun playNow() {
        val t = track ?: return
        playback.play(listOf(t))
        dismiss()
    }

    fun playNext() {
        val t = track ?: return
        playback.playNext(t)
        notify("Playing next: ${t.title}")
        dismiss()
    }

    fun addToQueue() {
        val t = track ?: return
        playback.addToQueue(t)
        notify("Added to queue")
        dismiss()
    }

    fun openPlaylistPicker() {
        if (track == null) return
        showPlaylistPicker = true
    }

    /** Leave the picker and ask for a new playlist name instead. */
    fun switchToCreate() {
        showPlaylistPicker = false
        createForPlaylist = true
    }

    fun openCreatePlaylist() {
        createForPlaylist = true
    }

    fun addTo(track: Track, playlistId: Long) {
        scope?.launch {
            val added = ServiceLocator.library.addToPlaylist(playlistId, track)
            notify(if (added) "Added to playlist" else "Already in that playlist")
            dismiss()
        } ?: dismiss()
    }

    fun createAndAdd(track: Track, name: String) {
        scope?.launch {
            val id = ServiceLocator.library.createPlaylist(name)
            ServiceLocator.library.addToPlaylist(id, track)
            notify("Created \"${name.ifBlank { "New playlist" }}\"")
            dismiss()
        } ?: dismiss()
    }

    fun toggleFavorite(t: Track) {
        scope?.launch {
            val added = ServiceLocator.library.toggleFavorite(t)
            notify(if (added) "Added to favourites" else "Removed from favourites")
        }
    }

    fun download(t: Track) {
        scope?.launch {
            val settings = ServiceLocator.settings.current()
            if (settings.downloadWifiOnly && !NetworkStatus.onWifi()) {
                notify("Downloads are set to Wi-Fi only")
                return@launch
            }
            ServiceLocator.downloads.enqueue(t)
            notify("Downloading ${t.title}")
        }
        dismiss()
    }

    fun openArtist() {
        val t = track ?: return
        if (t.artist.isBlank()) return
        dismiss()
        onOpenArtist(t.artist)
    }

    fun openAlbum() {
        val t = track ?: return
        dismiss()
        onOpenAlbum(t)
    }
}

val LocalTrackActions = staticCompositionLocalOf<TrackActionsState> {
    error("TrackActionsState not provided")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackActionsHost(state: TrackActionsState) {
    val track = state.track
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    LaunchedEffect(state) { state.attach(scope) }

    var isFavorite by remember(track?.key) { mutableStateOf(false) }
    LaunchedEffect(track?.key) {
        val key = track?.key ?: return@LaunchedEffect
        isFavorite = ServiceLocator.library.isFavorite(key)
    }

    if (track != null) {
        ModalBottomSheet(
            onDismissRequest = { state.dismiss() },
            sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
        ) {
            Column(Modifier.padding(bottom = Spacing.xxl)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MeloArt(track.artwork, Modifier.size(46.dp), corner = 12.dp)
                    Spacer(Modifier.width(Spacing.md))
                    Column(Modifier.weight(1f)) {
                        Text(
                            track.title,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            track.artist,
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                SheetAction("Play now", Icons.Rounded.PlayArrow) { state.playNow() }
                SheetAction("Play next", Icons.Rounded.PlaylistPlay) { state.playNext() }
                SheetAction("Add to queue", Icons.Rounded.QueueMusic) { state.addToQueue() }
                SheetAction("Add to playlist", Icons.Rounded.PlaylistAdd) { state.openPlaylistPicker() }
                SheetAction(
                    if (isFavorite) "Remove from favourites" else "Add to favourites",
                    if (isFavorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                ) {
                    state.toggleFavorite(track)
                    isFavorite = !isFavorite
                }
                SheetAction("Download", Icons.Rounded.Download) { state.download(track) }
                SheetAction("Go to artist", Icons.Rounded.Person) { state.openArtist() }
                SheetAction("Go to album", Icons.Rounded.Album) { state.openAlbum() }
            }
        }
    }

    if (state.showPlaylistPicker && track != null) {
        PlaylistPickerDialog(
            track = track,
            onDismiss = { state.dismiss() },
            onPick = { state.addTo(track, it) },
            onCreate = { state.switchToCreate() },
        )
    }

    if (state.createForPlaylist && track != null) {
        CreatePlaylistDialog(
            onDismiss = { state.dismiss() },
            onCreate = { name -> state.createAndAdd(track, name) },
        )
    }
}

@Composable
private fun SheetAction(label: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.screenH, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = LocalMeloColors.current.textSecondary, modifier = Modifier.size(21.dp))
        Spacer(Modifier.width(Spacing.lg))
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
fun PlaylistPickerDialog(
    track: Track,
    onDismiss: () -> Unit,
    onPick: (Long) -> Unit,
    onCreate: () -> Unit,
) {
    var playlists by remember { mutableStateOf<List<Playlist>>(emptyList()) }
    LaunchedEffect(Unit) {
        playlists = ServiceLocator.library.playlists.first()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add to playlist") },
        text = {
            Column {
                if (playlists.isEmpty()) {
                    Text(
                        "You don't have any playlists yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalMeloColors.current.textSecondary,
                    )
                } else {
                    LazyColumn(Modifier.height(260.dp)) {
                        items(playlists, key = { it.id }) { p ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onPick(p.id) }
                                    .padding(vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                MeloArt(p.coverArtwork, Modifier.size(36.dp), corner = 9.dp)
                                Spacer(Modifier.width(Spacing.md))
                                Column {
                                    Text(p.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                                    Text(
                                        "${p.trackCount} tracks",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                    )
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(Spacing.sm))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onCreate)
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(Spacing.md))
                    Text("New playlist", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleMedium)
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
fun CreatePlaylistDialog(
    title: String = "New playlist",
    initialName: String = "",
    onDismiss: () -> Unit,
    onCreate: (String) -> Unit,
) {
    var name by remember { mutableStateOf(initialName) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        },
        confirmButton = {
            TextButton(onClick = { onCreate(name.trim()) }, enabled = name.isNotBlank()) { Text("Create") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

/** Minimal connectivity check used to honour the Wi-Fi-only download preference. */
object NetworkStatus {
    fun onWifi(): Boolean {
        val cm = app.melo.player.MeloApp.instance
            .getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET)
    }

    fun isMetered(): Boolean {
        val cm = app.melo.player.MeloApp.instance
            .getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            ?: return false
        return cm.isActiveNetworkMetered
    }

    fun isOnline(): Boolean {
        val cm = app.melo.player.MeloApp.instance
            .getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}

@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String = "Delete",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message, style = MaterialTheme.typography.bodyMedium) },
        confirmButton = {
            TextButton(onClick = {
                onConfirm()
                onDismiss()
            }) { Text(confirmLabel, color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
