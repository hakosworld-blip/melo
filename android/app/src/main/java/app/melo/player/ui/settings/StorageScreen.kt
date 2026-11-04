package app.melo.player.ui.settings

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Cached
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Subtitles
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.melo.player.data.repo.StorageReport
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.components.formatBytes
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.launch

/**
 * Everything melo keeps on the device, in the four groups that can be cleared separately.
 *
 * Each row states what it holds before the button is pressed, and the confirmations say what
 * survives: deleting downloaded music takes the audio, the cover picture and the artist
 * metadata with it, while clearing lyrics leaves the song itself untouched.
 */
@Composable
fun StorageScreen(
    app: AppViewModel,
    onBack: () -> Unit,
    notify: (String) -> Unit,
) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    var report by remember { mutableStateOf(StorageReport()) }
    var busy by remember { mutableStateOf(false) }
    var confirmDownloads by remember { mutableStateOf(false) }
    var confirmLyrics by remember { mutableStateOf(false) }
    var confirmUserData by remember { mutableStateOf(false) }

    val reload = suspend {
        report = runCatching { ServiceLocator.storage.report() }.getOrDefault(report)
    }

    LaunchedEffect(Unit) { reload() }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader(
                title = "Storage",
                onBack = onBack,
                subtitle = "${formatBytes(report.measuredBytes)} used by melo",
            )
            LazyColumn(Modifier.fillMaxSize()) {
                item {
                    StorageItem(
                        icon = Icons.Rounded.Download,
                        title = "Downloaded music",
                        subtitle = downloadsSummary(report),
                        enabled = !busy && report.downloads.items > 0,
                    ) { confirmDownloads = true }
                }
                item {
                    StorageItem(
                        icon = Icons.Rounded.Subtitles,
                        title = "Lyrics",
                        subtitle = lyricsSummary(report),
                        enabled = !busy && report.lyrics.items > 0,
                    ) { confirmLyrics = true }
                }
                item {
                    StorageItem(
                        icon = Icons.Rounded.Cached,
                        title = "Cache",
                        subtitle = if (report.cache.bytes > 0) {
                            "${formatBytes(report.cache.bytes)} · artwork and streamed audio"
                        } else {
                            "Empty · artwork and streamed audio live here"
                        },
                        enabled = !busy && report.cache.bytes > 0,
                    ) {
                        scope.launch {
                            busy = true
                            val freed = runCatching { ServiceLocator.storage.clearCache() }.getOrDefault(0L)
                            reload()
                            busy = false
                            notify("Freed ${formatBytes(freed)} of cache")
                        }
                    }
                }
                item {
                    StorageItem(
                        icon = Icons.Rounded.Person,
                        title = "Your data",
                        subtitle = "Playlists, favourites, followed artists, history and searches",
                        enabled = !busy,
                    ) { confirmUserData = true }
                }
                item {
                    Column(Modifier.padding(horizontal = Spacing.screenH, vertical = Spacing.md)) {
                        Text(
                            "Downloads live in the melo folder on this device, so files stay yours and " +
                                "play without a connection. Nothing here is uploaded anywhere.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                        )
                    }
                }
                item { Spacer(Modifier.height(90.dp)) }
            }
        }
    }

    if (confirmDownloads) {
        ConfirmDialog(
            title = "Delete downloaded music?",
            message = "${report.downloads.items} songs are removed from this device, with the cover " +
                "picture and artist metadata saved beside each one. Playlists and favourites stay.",
            confirmLabel = "Delete",
            onConfirm = {
                scope.launch {
                    busy = true
                    runCatching { ServiceLocator.downloads.clearAll() }
                    reload()
                    busy = false
                    notify("Downloaded music removed")
                }
            },
            onDismiss = { confirmDownloads = false },
        )
    }

    if (confirmLyrics) {
        ConfirmDialog(
            title = "Remove saved lyrics?",
            message = "${report.lyrics.items} lyric files are deleted. The songs, their covers and " +
                "the artist metadata stay, and lyrics are fetched again when you open them.",
            confirmLabel = "Remove",
            onConfirm = {
                scope.launch {
                    busy = true
                    val removed = runCatching { ServiceLocator.storage.clearLyrics() }.getOrDefault(0)
                    reload()
                    busy = false
                    notify(if (removed > 0) "Removed $removed lyric files" else "Nothing to remove")
                }
            },
            onDismiss = { confirmLyrics = false },
        )
    }

    if (confirmUserData) {
        ConfirmDialog(
            title = "Clear your data?",
            message = "Playlists, favourites, followed artists, listening history and recent searches " +
                "are removed from this device. Downloads and settings stay.",
            confirmLabel = "Clear",
            onConfirm = {
                scope.launch {
                    busy = true
                    runCatching { ServiceLocator.library.clearAllLibraryData() }
                    reload()
                    busy = false
                    notify("Your data was cleared")
                }
            },
            onDismiss = { confirmUserData = false },
        )
    }
}

private fun downloadsSummary(report: StorageReport): String = when {
    report.downloads.items <= 0 -> "Nothing downloaded"
    else -> "${formatBytes(report.downloads.bytes)} · ${report.downloads.items} songs, with covers and metadata"
}

private fun lyricsSummary(report: StorageReport): String = when {
    report.lyrics.items <= 0 -> "No saved lyrics"
    else -> "${formatBytes(report.lyrics.bytes)} · ${report.lyrics.items} files saved beside songs"
}

@Composable
private fun StorageItem(
    icon: ImageVector,
    title: String,
    subtitle: String,
    enabled: Boolean,
    onClear: () -> Unit,
) {
    val colors = LocalMeloColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screenH, vertical = Spacing.xs)
            .clip(RoundedCornerShape(16.dp))
            .background(colors.surfaceElevated.copy(alpha = 0.6f))
            .padding(horizontal = Spacing.md, vertical = Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = colors.textPrimary)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(4.dp))
        Text(
            "Clear",
            style = MaterialTheme.typography.labelLarge,
            color = if (enabled) MaterialTheme.colorScheme.primary else colors.textSecondary.copy(alpha = 0.5f),
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(enabled = enabled, onClick = onClear)
                .padding(horizontal = 10.dp, vertical = 7.dp),
        )
    }
}
