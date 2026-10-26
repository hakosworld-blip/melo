package app.melo.player.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.melo.player.BuildConfig
import app.melo.player.data.lyrics.LyricsMode
import app.melo.player.data.model.StreamQuality
import app.melo.player.data.prefs.Settings
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.components.formatBytes
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Palettes
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun SettingsScreen(app: AppViewModel, onBack: () -> Unit) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var confirmReset by remember { mutableStateOf(false) }
    var confirmClearLibrary by remember { mutableStateOf(false) }
    var confirmClearDownloads by remember { mutableStateOf(false) }
    var confirmClearHistory by remember { mutableStateOf(false) }
    var showLicenses by remember { mutableStateOf(false) }

    val downloadBytes by ServiceLocator.database.downloadDao().totalBytes()
        .collectAsStateWithLifecycle(initialValue = 0L)
    val downloadCount by ServiceLocator.database.downloadDao().completed()
        .collectAsStateWithLifecycle(initialValue = emptyList())

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                val target = File(context.filesDir, "background.img")
                runCatching {
                    context.contentResolver.openInputStream(uri)?.use { input ->
                        target.outputStream().use { output -> input.copyTo(output) }
                    }
                    app.setBackgroundStyle("image")
                    app.setBackgroundImage(target.absolutePath)
                }
            }
        }
    }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader("settings", onBack = onBack)
            LazyColumn(Modifier.fillMaxSize()) {
                /* ------------------------- appearance ------------------------ */
                item { GroupTitle("Appearance") }
                item {
                    SettingBlock("Theme") {
                        Segmented(
                            options = listOf("dark" to "Dark", "light" to "Light", "system" to "System"),
                            selected = settings.themeMode,
                            onSelect = { app.setThemeMode(it) },
                        )
                    }
                }
                item {
                    SettingBlock("Accent colour") {
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                            Palettes.forEach { palette ->
                                val selected = palette.id == settings.paletteId
                                Box(
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .background(palette.accent)
                                        .then(
                                            if (selected) Modifier.border(2.dp, MaterialTheme.colorScheme.onBackground, CircleShape)
                                            else Modifier,
                                        )
                                        .clickable { app.setPalette(palette.id) },
                                )
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            Palettes.first { it.id == settings.paletteId }.label,
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                        )
                    }
                }
                item {
                    SettingBlock("Background") {
                        Segmented(
                            options = listOf(
                                "solid" to "Solid",
                                "gradient" to "Gradient",
                                "artwork" to "Artwork",
                                "image" to "Photo",
                            ),
                            selected = settings.backgroundStyle,
                            onSelect = { style ->
                                if (style == "image") {
                                    imagePicker.launch(
                                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                                    )
                                } else {
                                    app.setBackgroundStyle(style)
                                }
                            },
                        )
                        Spacer(Modifier.height(Spacing.sm))
                        SettingSwitch("Colour wash", "Tint the app with your accent", settings.backgroundGradient) {
                            app.setGradient(it)
                        }
                        SettingSwitch("Dynamic accent", "Use artwork colours where available", settings.dynamicAccent) {
                            app.setDynamicAccent(it)
                        }
                        if (settings.backgroundImageUri.isNotBlank()) {
                            Text(
                                "Custom photo in use",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.clickable {
                                    app.setBackgroundImage("")
                                    app.setBackgroundStyle("gradient")
                                }.padding(vertical = 6.dp),
                            )
                        }
                    }
                }
                item {
                    SettingSlider(
                        "Corner radius",
                        "${settings.cornerRadius}dp",
                        settings.cornerRadius.toFloat(),
                        0f..34f,
                    ) { app.setCornerRadius(it.toInt()) }
                }
                item {
                    SettingSwitch("Compact layout", "Tighter spacing for smaller screens", settings.compact) {
                        app.setCompact(it)
                    }
                }

                /* --------------------------- lyrics -------------------------- */
                item { GroupTitle("Lyrics") }
                item {
                    SettingBlock("Synchronisation") {
                        SegmentedWithValues(
                            options = LyricsMode.entries.map { it.id to it.label.split(" ").first() },
                            selected = settings.lyricsMode,
                            onSelect = { app.setLyricsMode(it) },
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Word mode needs word-level timestamps. melo only uses them when the provider publishes them, otherwise it falls back to line sync.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                        )
                    }
                }
                item {
                    SettingSlider(
                        "Text size",
                        "${settings.lyricsTextSize}sp",
                        settings.lyricsTextSize.toFloat(),
                        18f..52f,
                        steps = 33,
                    ) { app.setLyricsSize(it.toInt()) }
                }
                item {
                    SettingBlock("Font") {
                        Segmented(
                            options = listOf("sans" to "Sans", "serif" to "Serif", "mono" to "Mono"),
                            selected = settings.lyricsFont,
                            onSelect = { app.setLyricsFont(it) },
                        )
                    }
                }
                item {
                    SettingSwitch("Centre alignment", "Centre lyric lines", settings.lyricsAlignCenter) {
                        app.setLyricsAlignCenter(it)
                    }
                }
                item {
                    SettingSlider("Line spacing", "${settings.lyricsLineSpacing}", settings.lyricsLineSpacing.toFloat(), 0f..40f) {
                        app.setLyricsSpacing(it.toInt())
                    }
                }
                item {
                    SettingSwitch("Word karaoke", "Animate the active word", settings.lyricsWordKaraoke) {
                        app.setLyricsKaraoke(it)
                    }
                }
                item {
                    SettingSwitch("Auto-follow", "Scroll to the current line", settings.lyricsAutoScroll) {
                        app.setLyricsAutoScroll(it)
                    }
                }
                item {
                    SettingSwitch("Artwork backdrop", "Blurred artwork behind lyrics", settings.lyricsBackgroundArtwork) {
                        app.setLyricsBgArtwork(it)
                    }
                }
                item {
                    SettingSlider("Backdrop blur", "${settings.backgroundBlur}%", settings.backgroundBlur.toFloat(), 0f..100f) {
                        app.setBlur(it.toInt())
                    }
                }
                item {
                    SettingSlider("Backdrop dim", "${settings.backgroundDim}%", settings.backgroundDim.toFloat(), 0f..90f) {
                        app.setDim(it.toInt())
                    }
                }
                item {
                    SettingSlider(
                        "Sync offset",
                        "${settings.lyricsOffsetMs / 1000.0}s",
                        settings.lyricsOffsetMs.toFloat(),
                        -5000f..5000f,
                        steps = 19,
                    ) { app.setLyricsOffset(it.toInt()) }
                }

                /* -------------------------- playback ------------------------- */
                item { GroupTitle("Playback") }
                item {
                    SettingSwitch("Shuffle by default", "Start new queues shuffled", settings.shuffle) {
                        app.setShuffle(it)
                    }
                }
                item {
                    SettingBlock("Repeat") {
                        Segmented(
                            options = listOf("0" to "Off", "1" to "All", "2" to "One"),
                            selected = settings.repeatMode.toString(),
                            onSelect = { app.setRepeat(it.toInt()) },
                        )
                    }
                }
                item {
                    SettingSlider("Speed", "%.2fx".format(settings.playbackSpeed), settings.playbackSpeed, 0.5f..2f, steps = 14) {
                        app.setPlaybackSpeed((it * 20).toInt() / 20f)
                    }
                }
                item {
                    SettingBlock("Streaming quality") {
                        Segmented(
                            options = StreamQuality.entries.map { it.id to it.label.split(" ").first() },
                            selected = settings.streamQuality,
                            onSelect = { app.setStreamQuality(it) },
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Affects which audio format is requested from the provider. The best available is chosen by default.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                        )
                    }
                }
                item {
                    SettingSwitch("Stream on mobile data", "Off means playback waits for Wi-Fi", settings.mobileDataStreaming) {
                        app.setMobileData(it)
                    }
                }
                item {
                    SettingSwitch("Resume where you left off", "Reopen the last track on launch", settings.resumeOnStart) {
                        app.setResumeOnStart(it)
                    }
                }

                /* -------------------------- downloads ------------------------ */
                item { GroupTitle("Downloads") }
                item {
                    SettingBlock("Download quality") {
                        Segmented(
                            options = StreamQuality.entries.map { it.id to it.label.split(" ").first() },
                            selected = settings.downloadQuality,
                            onSelect = { app.setDownloadQuality(it) },
                        )
                    }
                }
                item {
                    SettingSwitch("Wi-Fi only", "Never download over mobile data", settings.downloadWifiOnly) {
                        app.setDownloadWifiOnly(it)
                    }
                }
                item {
                    SettingRow(
                        title = "Storage used",
                        subtitle = "${downloadCount.size} tracks · ${formatBytes(downloadBytes ?: 0L)}",
                        action = {
                            if (downloadCount.isNotEmpty()) {
                                Text(
                                    "Clear",
                                    color = MaterialTheme.colorScheme.error,
                                    style = MaterialTheme.typography.labelLarge,
                                    modifier = Modifier.clickable { confirmClearDownloads = true }.padding(8.dp),
                                )
                            }
                        },
                    )
                }

                /* --------------------------- privacy ------------------------- */
                item { GroupTitle("Privacy & data") }
                item {
                    SettingSwitch(
                        "Listening history",
                        "Used for home rows and recommendations. Stored only on this device.",
                        settings.historyEnabled,
                    ) { app.setHistoryEnabled(it) }
                }
                item {
                    SettingRow("Clear listening history", "Keeps favourites and playlists", {
                        Text(
                            "Clear",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.clickable { confirmClearHistory = true }.padding(8.dp),
                        )
                    })
                }
                item {
                    SettingRow(
                        "Clear image cache",
                        "Frees downloaded artwork; it reloads as needed",
                        {
                            Text(
                                "Clear",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.clickable {
                                    scope.launch {
                                        coil.Coil.imageLoader(context).diskCache?.clear()
                                        coil.Coil.imageLoader(context).memoryCache?.clear()
                                    }
                                }.padding(8.dp),
                            )
                        },
                    )
                }
                item {
                    SettingSlider(
                        "Streaming cache limit",
                        "${settings.cacheLimitMb} MB · applies after restart",
                        settings.cacheLimitMb.toFloat(),
                        128f..2048f,
                        steps = 14,
                    ) { app.setCacheLimit(it.toInt()) }
                }
                item {
                    SettingSwitch("Show statistics sources", "Label where listener counts come from", settings.showStatsSource) {
                        app.setShowStatsSource(it)
                    }
                }
                item {
                    SettingRow("Reset all settings", "Restore defaults, keep your library", {
                        Text(
                            "Reset",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.clickable { confirmReset = true }.padding(8.dp),
                        )
                    })
                }
                item {
                    SettingRow("Delete library data", "Removes playlists, favourites, follows and history", {
                        Text(
                            "Delete",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.labelLarge,
                            modifier = Modifier.clickable { confirmClearLibrary = true }.padding(8.dp),
                        )
                    })
                }

                /* ---------------------------- about -------------------------- */
                item { GroupTitle("About") }
                item {
                    SettingRow(
                        "melo",
                        "Version ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE}) · ${BuildConfig.BUILD_TYPE}",
                        action = {},
                    )
                }
                item {
                    SettingRow("Open source licences", "melo is built on open source software", {
                        Text(
                            "View",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.clickable { showLicenses = true }.padding(8.dp),
                        )
                    })
                }
                item {
                    Column(Modifier.padding(horizontal = Spacing.screenH, vertical = Spacing.md)) {
                        Text(
                            "melo plays music from public catalog endpoints (YouTube Music, SoundCloud) and reads " +
                                "metadata and lyrics from iTunes, Deezer, LRCLIB and NetEase. No account required, " +
                                "no analytics, no telemetry. Everything you create stays on this device.",
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                        )
                    }
                }
                item { Spacer(Modifier.height(80.dp)) }
            }
        }
    }

    if (confirmReset) {
        ConfirmDialog(
            title = "Reset all settings?",
            message = "Appearance, lyrics and playback preferences return to defaults. Your playlists, favourites and downloads stay.",
            confirmLabel = "Reset",
            onConfirm = { app.resetSettings() },
            onDismiss = { confirmReset = false },
        )
    }
    if (confirmClearLibrary) {
        ConfirmDialog(
            title = "Delete library data?",
            message = "Playlists, favourites, followed artists, history and recent searches are removed from this device. Downloads are kept.",
            confirmLabel = "Delete",
            onConfirm = { app.clearLibrary() },
            onDismiss = { confirmClearLibrary = false },
        )
    }
    if (confirmClearDownloads) {
        ConfirmDialog(
            title = "Delete all downloads?",
            message = "Files are removed from this device. You can download them again later.",
            confirmLabel = "Delete",
            onConfirm = { app.clearAllDownloads() },
            onDismiss = { confirmClearDownloads = false },
        )
    }
    if (confirmClearHistory) {
        ConfirmDialog(
            title = "Clear listening history?",
            message = "Your play history and the recommendations built from it are removed.",
            confirmLabel = "Clear",
            onConfirm = { app.clearHistory() },
            onDismiss = { confirmClearHistory = false },
        )
    }
    if (showLicenses) {
        LicensesDialog(onDismiss = { showLicenses = false })
    }
}

@Composable
private fun GroupTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = Spacing.screenH, top = Spacing.xl, bottom = Spacing.sm),
    )
}

@Composable
private fun SettingBlock(title: String, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH, vertical = Spacing.sm)) {
        Text(title, style = MaterialTheme.typography.titleMedium, color = LocalMeloColors.current.textPrimary)
        Spacer(Modifier.height(Spacing.sm))
        content()
    }
}

@Composable
private fun SettingRow(
    title: String,
    subtitle: String,
    action: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = LocalMeloColors.current.textSecondary,
            )
        }
        action()
    }
}

@Composable
private fun SettingSwitch(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onChange(!checked) }
            .padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            if (subtitle.isNotBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                )
            }
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun SettingSlider(
    title: String,
    valueLabel: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    steps: Int = 0,
    onChange: (Float) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH, vertical = Spacing.xs)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Text(valueLabel, style = MaterialTheme.typography.bodySmall, color = LocalMeloColors.current.textSecondary)
        }
        Slider(value = value, onValueChange = onChange, valueRange = range, steps = steps)
    }
}

@Composable
private fun Segmented(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(LocalMeloColors.current.surfaceElevated)
            .padding(3.dp),
    ) {
        options.forEach { (id, label) ->
            val isSelected = id == selected
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent)
                    .clickable { onSelect(id) }
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (isSelected) MaterialTheme.colorScheme.onPrimary else LocalMeloColors.current.textSecondary,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun SegmentedWithValues(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) =
    Segmented(options, selected, onSelect)

@Composable
private fun LicensesDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Open source licences") },
        text = {
            Column {
                Text(
                    "melo is derived from Riff, an open-source desktop music player released under the MIT licence. " +
                        "The original copyright notice and licence text are kept in LICENSE at the root of the repository.",
                    style = MaterialTheme.typography.bodySmall,
                )
                Spacer(Modifier.height(Spacing.md))
                listOf(
                    "AndroidX, Jetpack Compose, Media3 — Apache License 2.0",
                    "Kotlin, kotlinx.coroutines, kotlinx.serialization — Apache License 2.0",
                    "OkHttp — Apache License 2.0",
                    "Coil — Apache License 2.0",
                    "Room — Apache License 2.0",
                    "Guava — Apache License 2.0",
                ).forEach {
                    Text("• $it", style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(Spacing.md))
                Text(
                    "music data: YouTube Music and SoundCloud public endpoints; metadata: iTunes and Deezer; " +
                        "lyrics: LRCLIB and NetEase. melo is not affiliated with any of these services.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close") } },
    )
}
