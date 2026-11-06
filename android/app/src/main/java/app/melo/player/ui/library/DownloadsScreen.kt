package app.melo.player.ui.library

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Download
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import app.melo.player.data.db.DownloadEntity
import app.melo.player.data.db.toTrack
import app.melo.player.data.local.MeloMeta
import app.melo.player.data.local.MeloNames
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.CircleIconButton
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.components.SectionHeader
import app.melo.player.ui.components.TagChip
import app.melo.player.ui.components.formatBytes
import app.melo.player.ui.components.formatDuration
import app.melo.player.ui.shadcn.MeloProgress
import app.melo.player.ui.shadcn.Text
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Everything melo keeps offline.
 *
 * A song is never just an audio file: melo also writes its cover picture, its lyrics and a
 * details file beside it, and this screen says so — and deleting a song takes all of those
 * away again, not only the audio.
 */
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
    val scope = rememberCoroutineScope()
    val folder = ServiceLocator.folder

    val entries by ServiceLocator.database.downloadDao().all()
        .collectAsStateWithLifecycle(initialValue = emptyList())

    var confirmClear by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf<DownloadEntity?>(null) }
    var scanning by remember { mutableStateOf(false) }
    var kinds by remember { mutableStateOf<Map<String, Set<String>>>(emptyMap()) }

    val inProgress = entries.filter { it.status != "DONE" }
    val saved = entries.filter { it.status == "DONE" && it.quality != MeloMeta.LOCAL_QUALITY }
    val found = entries.filter { it.status == "DONE" && it.quality == MeloMeta.LOCAL_QUALITY }

    // Which files sit beside each song is read off the main thread.
    LaunchedEffect(entries) {
        kinds = withContext(Dispatchers.IO) {
            entries.associate { it.filePath to folder.sidecarKinds(it.filePath) }
        }
    }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader("downloads", onBack)

            Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH)) {
                Text(
                    "${saved.size} songs · ${formatBytes(saved.sumOf { it.bytes })}",
                    style = MeloTheme.type.bodyMedium,
                    color = LocalMeloColors.current.textSecondary,
                )
                Text(
                    "Folder: ${folder.displayPath} — every song keeps its cover, its lyrics and its artist details",
                    style = MeloTheme.type.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MeloTextButton(if (scanning) "Looking…" else "Look in folder") {
                    scanning = true
                    scope.launch {
                        ServiceLocator.downloads.scanFolder()
                        scanning = false
                    }
                }
                Spacer(Modifier.width(Spacing.md))
                if (saved.isNotEmpty()) {
                    MeloTextButton("Play all") { onPlay(saved.map { it.track.toTrack() }, 0) }
                }
            }

            if (entries.isEmpty()) {
                EmptyState(
                    title = "Nothing downloaded",
                    message = "Use Download in any song's menu: melo saves the audio, its cover picture, its lyrics and the artist details into its ${MeloNames.FOLDER} folder.",
                    icon = Icons.Rounded.Download,
                )
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    if (inProgress.isNotEmpty()) {
                        item { SectionHeader("In progress", "${inProgress.size} active") }
                        items(inProgress, key = { "active-${it.trackKey}" }) { entry ->
                            DownloadRow(
                                entry = entry,
                                fraction = progress[entry.trackKey],
                                kinds = emptySet(),
                                onClick = {},
                                onDelete = { scope.launch { ServiceLocator.downloads.delete(entry.trackKey) } },
                                onActions = { actions.show(entry.track.toTrack()) },
                            )
                        }
                    }

                    if (saved.isNotEmpty()) {
                        item { SectionHeader("Saved by melo", "Ready without a connection") }
                        items(saved, key = { it.trackKey }) { entry ->
                            DownloadRow(
                                entry = entry,
                                fraction = null,
                                kinds = kinds[entry.filePath].orEmpty(),
                                onClick = {
                                    val list = saved.map { it.track.toTrack() }
                                    val index = list.indexOfFirst { it.key == entry.trackKey }
                                    if (index >= 0) onPlay(list, index)
                                },
                                onDelete = { pendingDelete = entry },
                                onActions = { actions.show(entry.track.toTrack()) },
                            )
                        }
                    }

                    if (found.isNotEmpty()) {
                        item { SectionHeader("Also in the folder", "Files melo found there") }
                        items(found, key = { it.trackKey }) { entry ->
                            DownloadRow(
                                entry = entry,
                                fraction = null,
                                kinds = kinds[entry.filePath].orEmpty(),
                                onClick = {
                                    val list = found.map { it.track.toTrack() }
                                    val index = list.indexOfFirst { it.key == entry.trackKey }
                                    if (index >= 0) onPlay(list, index)
                                },
                                onDelete = { pendingDelete = entry },
                                onActions = { actions.show(entry.track.toTrack()) },
                            )
                        }
                    }

                    item {
                        Spacer(Modifier.height(Spacing.md))
                        Text(
                            "Delete downloaded songs",
                            style = MeloTheme.type.labelLarge,
                            color = MeloTheme.scheme.error,
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

    pendingDelete?.let { entry ->
        ConfirmDialog(
            title = "Delete \"${entry.track.title}\"?",
            message = "This deletes the song from the melo folder: the audio, the cover picture, the lyrics and the artist details saved beside it.",
            confirmLabel = "Delete",
            onConfirm = { scope.launch { ServiceLocator.downloads.delete(entry.trackKey) } },
            onDismiss = { pendingDelete = null },
        )
    }

    if (confirmClear) {
        ConfirmDialog(
            title = "Delete downloaded songs?",
            message = "Removes ${saved.size} songs and every file melo saved for them. Songs that were only found in the folder stay listed.",
            confirmLabel = "Delete",
            onConfirm = { scope.launch { ServiceLocator.downloads.clearAll() } },
            onDismiss = { confirmClear = false },
        )
    }
}

@Composable
private fun DownloadRow(
    entry: DownloadEntity,
    fraction: Float?,
    kinds: Set<String>,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onActions: () -> Unit,
) {
    val track = entry.track.toTrack()
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(enabled = entry.status == "DONE", onClick = onClick)
            .padding(horizontal = Spacing.screenH, vertical = 7.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MeloArt(track.artwork, Modifier.size(46.dp), corner = 11.dp)
            Spacer(Modifier.width(Spacing.md))
            Column(Modifier.weight(1f)) {
                Text(
                    track.title,
                    style = MeloTheme.type.titleMedium,
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
                    style = MeloTheme.type.bodySmall,
                    color = if (entry.status == "FAILED") MeloTheme.scheme.error
                    else LocalMeloColors.current.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (kinds.isNotEmpty()) {
                    Row(
                        modifier = Modifier.padding(top = 3.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        if ("art" in kinds) TagChip("cover")
                        if ("lyrics" in kinds) TagChip("lyrics")
                        if ("meta" in kinds) TagChip("details")
                    }
                }
            }
            if (entry.status == "DONE") {
                Text(
                    formatDuration(track.durationMs),
                    style = MeloTheme.type.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                )
            }
            CircleIconButton(Icons.Rounded.Delete, "Delete song") { onDelete() }
            OverflowButton { onActions() }
        }
        if (entry.status == "RUNNING" && fraction != null && fraction >= 0f) {
            Spacer(Modifier.height(6.dp))
            MeloProgress(
                progress = { fraction },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = MeloTheme.scheme.primary,
            )
        }
    }
}
