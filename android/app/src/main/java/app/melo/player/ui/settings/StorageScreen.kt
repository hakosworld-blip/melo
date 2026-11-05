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
import androidx.compose.material.icons.rounded.Warning
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import app.melo.player.R
import app.melo.player.data.repo.StorageReport
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.components.formatBytes
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing

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

    LaunchedEffect(Unit) {
        try {
            report = ServiceLocator.storage.report()
        } catch (_: Throwable) {
            report = StorageReport()
        }
        ServiceLocator.storage.reportFlow()
            .catch { report = StorageReport() }
            .collect { report = it }
    }

    // Free space comes back with the report, so the warning tracks reality instead of a guess.
    val lowSpace = report.freeBytes > 0L &&
        report.freeBytes < settings.storageLowSpaceThresholdMb * 1_048_576L

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
                if (lowSpace) {
                    item {
                        LowSpaceBanner(
                            stringResource(
                                R.string.storage_low_space_body,
                                formatBytes(report.freeBytes),
                            ),
                        )
                    }
                }
                item {
                    StorageItem(
                        icon = Icons.Rounded.Download,
                        title = stringResource(R.string.storage_downloads),
                        subtitle = downloadsSummary(report),
                        enabled = !busy && report.downloads.items > 0,
                    ) { confirmDownloads = true }
                }
                item {
                    StorageItem(
                        icon = Icons.Rounded.Subtitles,
                        title = stringResource(R.string.storage_lyrics),
                        subtitle = lyricsSummary(report),
                        enabled = !busy && report.lyrics.items > 0,
                    ) { confirmLyrics = true }
                }
                item {
                    StorageItem(
                        icon = Icons.Rounded.Cached,
                        title = stringResource(R.string.storage_cache),
                        subtitle = if (report.cache.bytes > 0) {
                            "${formatBytes(report.cache.bytes)} · artwork and streamed audio"
                        } else {
                            "Empty · artwork and streamed audio live here"
                        },
                        enabled = !busy && report.cache.bytes > 0,
                    ) {
                        scope.launch {
                            busy = true
                            val freed = ServiceLocator.storage.clearCache()
                            report = ServiceLocator.storage.report()
                            busy = false
                            notify("Freed ${formatBytes(freed)} of cache")
                        }
                    }
                }
                item {
                    StorageItem(
                        icon = Icons.Rounded.Person,
                        title = stringResource(R.string.storage_user_data),
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

    val clearedDownloadsMessage = stringResource(R.string.storage_cleared_downloads)
    val clearedLyricsMessage = stringResource(R.string.storage_cleared_lyrics)
    val clearedUserDataMessage = stringResource(R.string.storage_cleared_user_data)
    val clearLabel = stringResource(R.string.action_clear)

    if (confirmDownloads) {
        ConfirmDialog(
            title = stringResource(R.string.storage_clear_downloads_title),
            message = stringResource(
                R.string.storage_clear_downloads_message,
                report.downloads.items,
            ),
            confirmLabel = clearLabel,
            onConfirm = {
                scope.launch {
                    busy = true
                    runCatching { ServiceLocator.storage.clearDownloads() }
                    report = ServiceLocator.storage.report()
                    busy = false
                    notify(clearedDownloadsMessage)
                }
            },
            onDismiss = { confirmDownloads = false },
        )
    }

    if (confirmLyrics) {
        ConfirmDialog(
            title = stringResource(R.string.storage_clear_lyrics_title),
            message = stringResource(
                R.string.storage_clear_lyrics_message,
                report.lyrics.items,
            ),
            confirmLabel = clearLabel,
            onConfirm = {
                scope.launch {
                    busy = true
                    runCatching { ServiceLocator.storage.clearLyrics() }
                    report = ServiceLocator.storage.report()
                    busy = false
                    notify(clearedLyricsMessage)
                }
            },
            onDismiss = { confirmLyrics = false },
        )
    }

    if (confirmUserData) {
        ConfirmDialog(
            title = stringResource(R.string.storage_clear_user_data_title),
            message = stringResource(R.string.storage_clear_user_data_message),
            confirmLabel = clearLabel,
            onConfirm = {
                scope.launch {
                    busy = true
                    runCatching { ServiceLocator.storage.clearUserData() }
                    report = ServiceLocator.storage.report()
                    busy = false
                    notify(clearedUserDataMessage)
                }
            },
            onDismiss = { confirmUserData = false },
        )
    }
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
            stringResource(R.string.storage_clear_label),
            style = MaterialTheme.typography.labelLarge,
            color = if (enabled) MaterialTheme.colorScheme.primary else colors.textSecondary.copy(alpha = 0.5f),
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(enabled = enabled, onClick = onClear)
                .padding(horizontal = 10.dp, vertical = 7.dp),
        )
    }
}

@Composable
private fun LowSpaceBanner(message: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screenH, vertical = Spacing.xs)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.error.copy(alpha = 0.12f))
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(
            Icons.Rounded.Warning,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(20.dp),
        )
        Column {
            Text(
                stringResource(R.string.storage_low_space_title),
                style = MaterialTheme.typography.titleSmall,
                color = LocalMeloColors.current.textPrimary,
            )
            Text(
                message,
                style = MaterialTheme.typography.bodySmall,
                color = LocalMeloColors.current.textSecondary,
            )
        }
    }
}

@Composable
private fun downloadsSummary(report: StorageReport): String = when {
    report.downloads.items <= 0 -> stringResource(R.string.storage_empty)
    else -> "${formatBytes(report.downloads.bytes)} · ${report.downloads.items} songs, with covers and metadata"
}

@Composable
private fun lyricsSummary(report: StorageReport): String = when {
    report.lyrics.items <= 0 -> stringResource(R.string.storage_empty)
    else -> "${formatBytes(report.lyrics.bytes)} · ${report.lyrics.items} files saved beside songs"
}
