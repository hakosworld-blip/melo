package app.melo.player.ui.settings

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.melo.player.AppInfo
import app.melo.player.BuildConfig
import app.melo.player.data.lyrics.LyricsMode
import app.melo.player.data.model.StreamQuality
import app.melo.player.data.prefs.Settings
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.ExtractorStatus
import app.melo.player.ui.UpdateStatus
import app.melo.player.ui.brand.IconVariant
import app.melo.player.ui.brand.IconVariants
import app.melo.player.ui.brand.MeloMark
import app.melo.player.ui.brand.iconVariantById
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Palettes
import app.melo.player.ui.theme.paletteById
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.io.File
import java.util.Locale

@Composable
fun SettingsScreen(app: AppViewModel, onBack: () -> Unit, onOpenStorage: () -> Unit) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val extractor by app.extractor.collectAsStateWithLifecycle()
    val updates by app.updates.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var confirmReset by remember { mutableStateOf(false) }
    var confirmClearLibrary by remember { mutableStateOf(false) }
    var confirmClearHistory by remember { mutableStateOf(false) }
    var showLicenses by remember { mutableStateOf(false) }
    var showIconPicker by remember { mutableStateOf(false) }
    var showLogoPicker by remember { mutableStateOf(false) }

    // Remembered: calling the DAO from composition builds a fresh Flow on every recomposition,
    // and this screen recomposes on every preference change.
    val downloadDao = remember { ServiceLocator.database.downloadDao() }
    val downloadCount by remember(downloadDao) { downloadDao.completed() }
        .collectAsStateWithLifecycle(initialValue = emptyList())
    val qualityOptions = remember {
        StreamQuality.entries.map { it.id to it.label.split(" ").first() }
    }

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
                        settings.cornerRadius.toFloat(),
                        0f..34f,
                        format = { "${it.toInt()}dp" },
                    ) { app.setCornerRadius(it.toInt()) }
                }
                item {
                    SettingSwitch("Compact layout", "Tighter spacing for smaller screens", settings.compact) {
                        app.setCompact(it)
                    }
                }

                /* ------------------------ customization ---------------------- */
                item { GroupTitle("Customization") }
                item {
                    SettingBlock("Accent colour") {
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                            Palettes.forEach { palette ->
                                // A custom colour takes the selection away from every preset.
                                val selected = !settings.customAccent && palette.id == settings.paletteId
                                Box(
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .background(palette.accent)
                                        .then(
                                            if (selected) {
                                                Modifier.border(2.dp, MaterialTheme.colorScheme.onBackground, CircleShape)
                                            } else {
                                                Modifier
                                            },
                                        )
                                        .clickable { app.setPalette(palette.id) },
                                )
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(
                            if (settings.customAccent) "Custom colour" else paletteById(settings.paletteId).label,
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                        )
                        Spacer(Modifier.height(Spacing.sm))
                        SettingSwitch(
                            "Custom accent",
                            "Mix any colour you like with the sliders",
                            settings.customAccent,
                        ) { app.setCustomAccent(it) }
                        if (settings.customAccent) {
                            AccentMixer(argb = settings.accentColor, onPick = { app.setAccentColor(it) })
                        }
                    }
                }
                item {
                    SettingBlock("App icon") {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            MeloMark(settings.appIconId, size = 54.dp)
                            Spacer(Modifier.width(Spacing.md))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    iconVariantById(settings.appIconId).label,
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Text(
                                    "The icon on your home screen. Pick any of the 27 styles, then let your launcher refresh.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LocalMeloColors.current.textSecondary,
                                )
                            }
                            Text(
                                "Change",
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.labelLarge,
                                modifier = Modifier.clickable { showIconPicker = true }.padding(8.dp),
                            )
                        }
                    }
                }
                item {
                    SettingBlock("Logo in the app") {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            MeloMark(settings.logoId, size = 54.dp)
                            Spacer(Modifier.width(Spacing.md))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    iconVariantById(settings.logoId).label,
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Text(
                                    "The mark beside the greeting on your home screen. It can differ from the app icon.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LocalMeloColors.current.textSecondary,
                                )
                            }
                            Text(
                                "Change",
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.labelLarge,
                                modifier = Modifier.clickable { showLogoPicker = true }.padding(8.dp),
                            )
                        }
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
                        settings.lyricsTextSize.toFloat(),
                        18f..52f,
                        steps = 33,
                        format = { "${it.toInt()}sp" },
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
                    SettingSlider(
                        "Line spacing",
                        settings.lyricsLineSpacing.toFloat(),
                        0f..40f,
                        format = { "${it.toInt()}" },
                    ) { app.setLyricsSpacing(it.toInt()) }
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
                    SettingSlider(
                        "Backdrop blur",
                        settings.backgroundBlur.toFloat(),
                        0f..100f,
                        format = { "${it.toInt()}%" },
                    ) { app.setBlur(it.toInt()) }
                }
                item {
                    SettingSlider(
                        "Backdrop dim",
                        settings.backgroundDim.toFloat(),
                        0f..90f,
                        format = { "${it.toInt()}%" },
                    ) { app.setDim(it.toInt()) }
                }
                item {
                    SettingSlider(
                        "Sync offset",
                        settings.lyricsOffsetMs.toFloat(),
                        -5000f..5000f,
                        steps = 19,
                        format = { "${it.toInt() / 1000.0}s" },
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
                    SettingSwitch(
                        "Gapless playback",
                        "Tracks join without a pause when the audio allows it",
                        settings.gapless,
                    ) { app.setGapless(it) }
                }
                item {
                    SettingSlider(
                        "Crossfade",
                        settings.crossfadeSeconds.toFloat(),
                        0f..12f,
                        steps = 11,
                        format = { if (it < 0.5f) "Off" else "${it.toInt()}s" },
                    ) { app.setCrossfade(it.toInt()) }
                }
                item {
                    SettingSlider(
                        "Speed",
                        settings.playbackSpeed,
                        0.5f..2f,
                        steps = 14,
                        format = { "%.2fx".format(it) },
                    ) { app.setPlaybackSpeed((it * 20).toInt() / 20f) }
                }
                item {
                    SettingBlock("Streaming quality") {
                        Segmented(
                            options = qualityOptions,
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
                    SettingRow(
                        "yt-dlp nightly",
                        extractorSummary(extractor),
                        action = {
                            Text(
                                if (extractor.busy) "Working…" else "Update",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .clickable(enabled = !extractor.busy) { app.refreshExtractor() }
                                    .padding(8.dp),
                            )
                        },
                    )
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
                            options = qualityOptions,
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
                        title = "Storage",
                        subtitle = "${downloadCount.size} downloads · clear lyrics, cache and your data",
                        action = {
                            Text(
                                "Manage",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .clickable(onClick = onOpenStorage)
                                    .padding(8.dp),
                            )
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
                    SettingSlider(
                        "Streaming cache limit",
                        settings.cacheLimitMb.toFloat(),
                        128f..2048f,
                        steps = 14,
                        format = { "${it.toInt()} MB · applies after restart" },
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
                        "Version",
                        "${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE}) · ${BuildConfig.BUILD_TYPE}",
                        action = {},
                    )
                }
                item {
                    SettingRow(
                        "App update",
                        updateSummary(updates),
                        action = {
                            Text(
                                if (updates.checking) "Checking…" else "Check",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .clickable(enabled = !updates.checking) { app.checkForUpdates() }
                                    .padding(8.dp),
                            )
                        },
                    )
                }
                item {
                    SettingSwitch(
                        "Check automatically",
                        "Looks for a newer release once a day when melo starts",
                        settings.autoUpdateCheck,
                    ) { app.setAutoUpdateCheck(it) }
                }
                updates.available?.let { release ->
                    item {
                        SettingRow(
                            "Download version ${release.version}",
                            "Opens the release page in your browser",
                            action = {
                                Text(
                                    "Get",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier
                                        .clickable { openUrl(context, release.pageUrl) }
                                        .padding(8.dp),
                                )
                            },
                        )
                    }
                }
                item {
                    SettingRow(
                        "GitHub repository",
                        AppInfo.RepoLabel,
                        action = {
                            Text(
                                "Open",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .clickable { openUrl(context, AppInfo.RepoUrl) }
                                    .padding(8.dp),
                            )
                        },
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
    if (showIconPicker) {
        IconPickerDialog(
            title = "App icon",
            subtitle = "Your pick is applied straight away. Most launchers show the new icon right away; a few need a moment or a redraw.",
            selected = settings.appIconId,
            onSelect = { id ->
                app.setAppIcon(id)
                showIconPicker = false
            },
            onDismiss = { showIconPicker = false },
        )
    }
    if (showLogoPicker) {
        IconPickerDialog(
            title = "Logo in the app",
            subtitle = "Used wherever melo shows its own mark inside the app.",
            selected = settings.logoId,
            onSelect = { id ->
                app.setLogo(id)
                showLogoPicker = false
            },
            onDismiss = { showLogoPicker = false },
        )
    }
}

@Composable
private fun IconPickerDialog(
    title: String,
    subtitle: String,
    selected: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            shape = RoundedCornerShape(26.dp),
            color = LocalMeloColors.current.surfaceElevated,
            modifier = Modifier.fillMaxWidth(0.94f),
        ) {
            Column(Modifier.padding(vertical = Spacing.md)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(horizontal = Spacing.screenH),
                )
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                    modifier = Modifier.padding(horizontal = Spacing.screenH, vertical = 4.dp),
                )
                LazyVerticalGrid(
                    columns = GridCells.Fixed(4),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalArrangement = Arrangement.spacedBy(Spacing.md),
                ) {
                    items(IconVariants, key = { it.id }) { variant ->
                        IconChoice(
                            variant = variant,
                            selected = variant.id == selected,
                            onClick = { onSelect(variant.id) },
                        )
                    }
                }
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End).padding(end = Spacing.sm),
                ) { Text("Close") }
            }
        }
    }
}

@Composable
private fun IconChoice(variant: IconVariant, selected: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 6.dp, horizontal = 2.dp),
    ) {
        MeloMark(variant.id, size = 52.dp, highlighted = selected)
        Spacer(Modifier.height(6.dp))
        Text(
            variant.label,
            style = MaterialTheme.typography.labelSmall,
            color = if (selected) MaterialTheme.colorScheme.primary else LocalMeloColors.current.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )
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
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    steps: Int = 0,
    format: (Float) -> String,
    onDrag: ((Float) -> Unit)? = null,
    onCommit: (Float) -> Unit,
) {
    // The thumb and its label follow the finger locally; the preference is written once, when
    // the drag ends. Writing on every frame queued dozens of DataStore edits per drag and
    // repainted the whole screen each time, which is exactly what a drag must not do.
    var dragging by remember { mutableStateOf<Float?>(null) }
    val shown = dragging ?: value

    Column(Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH, vertical = Spacing.xs)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Text(format(shown), style = MaterialTheme.typography.bodySmall, color = LocalMeloColors.current.textSecondary)
        }
        Slider(
            value = shown,
            onValueChange = {
                dragging = it
                onDrag?.invoke(it)
            },
            valueRange = range,
            steps = steps,
            onValueChangeFinished = {
                dragging?.let(onCommit)
                dragging = null
            },
        )
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

/**
 * Hue / saturation / brightness mixer for a custom accent.
 *
 * The sliders keep their own HSV state while dragging, so the hue survives low saturation
 * instead of collapsing to grey, and the colour is written to settings when a drag ends rather
 * than on every frame.
 */
@Composable
private fun AccentMixer(argb: Int, onPick: (Int) -> Unit) {
    val seed = remember { FloatArray(3).also { android.graphics.Color.colorToHSV(argb, it) } }
    var hue by remember { mutableFloatStateOf(seed[0]) }
    var saturation by remember { mutableFloatStateOf(seed[1].coerceAtLeast(0.35f)) }
    var brightness by remember { mutableFloatStateOf(seed[2].coerceAtLeast(0.45f)) }

    val preview = Color.hsv(hue, saturation, brightness)
    // Reads the live HSV state, so the colour saved is the one on screen even when a slider
    // commits before the next recomposition.
    val commit = { onPick(Color.hsv(hue, saturation, brightness).toArgb()) }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(preview)
                .border(1.dp, LocalMeloColors.current.outlineStrong, CircleShape),
        )
        Spacer(Modifier.width(Spacing.md))
        Text(
            String.format(Locale.US, "#%06X", preview.toArgb() and 0xFFFFFF),
            style = MaterialTheme.typography.titleMedium,
            color = LocalMeloColors.current.textPrimary,
        )
    }
    Spacer(Modifier.height(Spacing.sm))
    // onDrag keeps the preview swatch live; onCommit writes the colour once, per slider.
    SettingSlider(
        "Hue",
        hue,
        0f..360f,
        format = { "${it.toInt()}°" },
        onDrag = { hue = it },
        onCommit = { hue = it; commit() },
    )
    SettingSlider(
        "Saturation",
        saturation,
        0f..1f,
        format = { "${(it * 100).toInt()}%" },
        onDrag = { saturation = it },
        onCommit = { saturation = it; commit() },
    )
    SettingSlider(
        "Brightness",
        brightness,
        0.15f..1f,
        format = { "${(it * 100).toInt()}%" },
        onDrag = { brightness = it },
        onCommit = { brightness = it; commit() },
    )
}

/** One-line description of the update check, for its settings row. */
private fun updateSummary(status: UpdateStatus): String = when {
    status.checking -> "Checking the newest release…"
    status.available != null -> "Version ${status.available.version} is available"
    status.error != null -> status.error
    status.latestVersion != null -> "Up to date · ${status.latestVersion}"
    else -> "Not checked yet"
}

/** One-line description of the fallback extractor, for its settings row. */
private fun extractorSummary(status: ExtractorStatus): String = when {
    status.busy -> "Fetching the newest nightly build…"
    status.version != null -> "Nightly ${status.version} · used when the fast path fails"
    status.error != null -> "Unavailable · ${status.error}"
    else -> "Not installed yet · tap Update to fetch the nightly extractor"
}

/** Opens a link outside the app; a device with no browser simply ignores it. */
private fun openUrl(context: android.content.Context, url: String) {
    runCatching {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
