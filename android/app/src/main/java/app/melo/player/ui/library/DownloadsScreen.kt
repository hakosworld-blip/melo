package app.melo.player.ui.library

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.components.CircleIconButton
import app.melo.player.data.db.toTrack
import app.melo.player.ui.components.formatBytes
import app.melo.player.ui.components.formatDuration
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.launch

@Composable
fun DownloadsScreen(
    app: AppViewModel,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val progress by ServiceLocator.downloads.progress.collectAsStateWithLifecycle()
    val actions = LocalTrackActions.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    val entries by ServiceLocator.database.downloadDao().all()
        .collectAsStateWithLifecycle(initialValue = emptyList())
    var confirmClear by remember { mutableStateOf(false) }

    val completed = entries.filter { it.status == "DONE" }
    val totalBytes = completed.sumOf { it.bytes }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader("downloads", onBack)

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screenH),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "${completed.size} tracks · ${formatBytes(totalBytes)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LocalMeloColors.current.textSecondary,
                    )
                    Text(
                        "Saved in this app's storage",
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalMeloColors.current.textSecondary,
                    )
                }
                if (completed.isNotEmpty()) {
                    MeloTextButton("Play all") { onPlay(completed.map { it.track.toTrack() }, 0) }
                }
            }
            Spacer(Modifier.height(Spacing.sm))

            if (entries.isEmpty()) {
                EmptyState(
                    title = "Nothing downloaded",
                    message = "Use Download in any song's menu to keep it for offline listening.",
                    icon = Icons.Rounded.Download,
                )
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(entries, key = { it.trackKey }) { entry ->
                        val track = entry.track.toTrack()
                        val fraction = progress[entry.trackKey]
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clickable(enabled = entry.status == "DONE") {
                                    val list = completed.map { it.track.toTrack() }
                                    val index = list.indexOfFirst { it.key == entry.trackKey }
                                    if (index >= 0) onPlay(list, index)
                                }
                                .padding(horizontal = Spacing.screenH, vertical = 7.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                MeloArt(track.artwork, Modifier.size(46.dp), corner = 11.dp)
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        track.title,
                                        style = MaterialTheme.typography.titleMedium,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        buildString {
                                            append(track.artist)
                                            when (entry.status) {
                                                "DONE" -> append(" · ").append(formatBytes(entry.bytes))
                                                "RUNNING" -> append(" · downloading")
                                                "QUEUED" -> append(" · queued")
                                                "FAILED" -> append(" · ").append(entry.error.ifBlank { "failed" })
                                                "CANCELLED" -> append(" · cancelled")
                                            }
                                        },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (entry.status == "FAILED") MaterialTheme.colorScheme.error
                                        else LocalMeloColors.current.textSecondary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                                if (entry.status == "DONE") {
                                    Text(
                                        formatDuration(track.durationMs),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                    )
                                }
                                CircleIconButton(Icons.Rounded.Delete, "Delete download") {
                                    scope.launch { ServiceLocator.downloads.delete(entry.trackKey) }
                                }
                                OverflowButton { actions.show(track) }
                            }
                            if (entry.status == "RUNNING" && fraction != null && fraction >= 0f) {
                                Spacer(Modifier.height(6.dp))
                                LinearProgressIndicator(
                                    progress = { fraction },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(3.dp)
                                        .clip(RoundedCornerShape(2.dp)),
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    }
                    item {
                        Spacer(Modifier.height(Spacing.md))
                        Text(
                            "Clear all downloads",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier
                                .padding(horizontal = Spacing.screenH)
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { confirmClear = true }
                                .padding(vertical = 12.dp),
                        )
                        Spacer(Modifier.height(40.dp))
                    }
                }
            }
        }
    }

    if (confirmClear) {
        ConfirmDialog(
            title = "Delete all downloads?",
            message = "This removes ${completed.size} files from this device. You can download them again later.",
            confirmLabel = "Delete all",
            onConfirm = { scope.launch { ServiceLocator.downloads.clearAll() } },
            onDismiss = { confirmClear = false },
        )
    }
}

