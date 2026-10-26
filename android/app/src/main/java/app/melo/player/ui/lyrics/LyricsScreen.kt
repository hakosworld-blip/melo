package app.melo.player.ui.lyrics

import android.os.Build
import android.provider.Settings as AndroidSettings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.melo.player.data.lyrics.LyricDocument
import app.melo.player.data.lyrics.LyricLine
import app.melo.player.data.lyrics.LyricsMode
import app.melo.player.data.lyrics.LyricsSync
import app.melo.player.data.model.Track
import app.melo.player.data.remote.LyricsRemote
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.CircleIconButton
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LoadingRow
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import app.melo.player.ui.theme.lyricsFamily
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

sealed interface LyricsUi {
    data object Loading : LyricsUi
    data class Ready(val doc: LyricDocument) : LyricsUi
    data class Failed(val message: String) : LyricsUi
    data object Empty : LyricsUi
}

class LyricsViewModel : ViewModel() {
    private val _state = MutableStateFlow<LyricsUi>(LyricsUi.Loading)
    val state: StateFlow<LyricsUi> = _state.asStateFlow()

    private var loadedKey: String? = null

    fun load(track: Track?) {
        if (track == null) {
            _state.value = LyricsUi.Empty
            return
        }
        if (loadedKey == track.key && _state.value is LyricsUi.Ready) return
        loadedKey = track.key
        viewModelScope.launch {
            _state.value = LyricsUi.Loading
            val outcome = runCatching { LyricsRemote.fetch(track) }
            _state.value = outcome.fold(
                onSuccess = { doc ->
                    if (doc.isEmpty) LyricsUi.Empty else LyricsUi.Ready(doc)
                },
                onFailure = { LyricsUi.Failed("Couldn't reach the lyrics service.") },
            )
        }
    }

    fun retry(track: Track?) {
        loadedKey = null
        load(track)
    }

    companion object {
        val Factory = viewModelFactory { initializer { LyricsViewModel() } }
    }
}

/** Respects the system "remove animations" accessibility setting. */
@Composable
private fun rememberReducedMotion(): Boolean {
    val context = LocalContext.current
    return remember {
        runCatching {
            AndroidSettings.Global.getFloat(
                context.contentResolver,
                AndroidSettings.Global.ANIMATOR_DURATION_SCALE,
                1f,
            ) == 0f
        }.getOrDefault(false)
    }
}

/**
 * Smoother playback position than the 500 ms player tick: interpolates from the last
 * reported position so word highlighting advances evenly.
 */
@Composable
private fun rememberSmoothPosition(app: AppViewModel, playing: Boolean, base: Long, speed: Float): Long {
    var smooth by remember { mutableLongStateOf(base) }
    LaunchedEffect(playing, base, speed) {
        if (!playing) {
            smooth = base
            return@LaunchedEffect
        }
        val started = android.os.SystemClock.elapsedRealtime()
        while (isActive) {
            val elapsed = android.os.SystemClock.elapsedRealtime() - started
            smooth = base + (elapsed * speed).toLong()
            delay(50)
        }
    }
    return smooth
}

@Composable
fun LyricsScreen(app: AppViewModel, onClose: () -> Unit) {
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val settings by app.settings.collectAsStateWithLifecycle()
    val vm: LyricsViewModel = viewModel(factory = LyricsViewModel.Factory)
    val ui by vm.state.collectAsStateWithLifecycle()
    val track = playback.current
    val reducedMotion = rememberReducedMotion()

    LaunchedEffect(track?.key) { vm.load(track) }

    val position = rememberSmoothPosition(app, playback.isPlaying, playback.positionMs, playback.speed) +
        settings.lyricsOffsetMs

    val doc = (ui as? LyricsUi.Ready)?.doc
    val mode = remember(doc, settings.lyricsMode) {
        doc?.supportedMode(LyricsMode.fromId(settings.lyricsMode)) ?: LyricsMode.fromId(settings.lyricsMode)
    }

    val blurDp = if (Build.VERSION.SDK_INT >= 31) (settings.backgroundBlur / 100f * 48f).dp else 0.dp
    val extraScrim = if (Build.VERSION.SDK_INT >= 31) 0f else settings.backgroundBlur / 100f * 0.25f

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // Artwork backdrop
        if (settings.lyricsBackgroundArtwork && !track?.artwork.isNullOrBlank()) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(track?.artwork)
                    .crossfade(500)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer { scaleX = 1.25f; scaleY = 1.25f }
                    .blur(blurDp),
            )
        }
        // Readability overlay: dim + optional gradient
        val dim = (settings.backgroundDim / 100f).coerceIn(0f, 0.95f) + extraScrim
        Box(
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background.copy(alpha = dim.coerceIn(0f, 0.95f))),
        )
        if (settings.backgroundGradient) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color.Black.copy(alpha = 0.45f),
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.65f),
                            ),
                        ),
                    ),
            )
        }

        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            // Top bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircleIconButton(
                    Icons.Rounded.KeyboardArrowDown,
                    "Close lyrics",
                    onClick = onClose,
                    tint = Color.White.copy(alpha = 0.85f),
                )
                Column(Modifier.weight(1f)) {
                    Text(
                        track?.title ?: "Lyrics",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        maxLines = 1,
                    )
                    Text(
                        track?.artist.orEmpty(),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.65f),
                        maxLines = 1,
                    )
                }
                ModeChip(
                    label = when (mode) {
                        LyricsMode.WORD -> "Word"
                        LyricsMode.LINE -> "Line"
                        LyricsMode.PLAIN -> "Plain"
                    },
                    onClick = {
                        val next = when (mode) {
                            LyricsMode.WORD -> LyricsMode.LINE
                            LyricsMode.LINE -> LyricsMode.PLAIN
                            LyricsMode.PLAIN -> LyricsMode.WORD
                        }
                        app.setLyricsMode(next.id)
                    },
                )
            }

            // Honest capability note
            if (doc != null && LyricsMode.fromId(settings.lyricsMode) == LyricsMode.WORD && !doc.hasWordTiming) {
                Text(
                    "Word timings aren't published for this track — showing line sync.",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.6f),
                    modifier = Modifier.padding(horizontal = Spacing.screenH, vertical = 4.dp),
                )
            }
            if (doc != null && doc.hasLineTiming && !doc.hasWordTiming && LyricsMode.fromId(settings.lyricsMode) == LyricsMode.WORD) {
                // handled above
            }

            Box(Modifier.weight(1f)) {
                when (val state = ui) {
                    is LyricsUi.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        LoadingRow("Finding lyrics")
                    }
                    is LyricsUi.Empty -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                if (track == null) "Nothing playing" else "No lyrics for this track",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                if (track == null) "Start a song to see its lyrics."
                                else "LRCLIB, NetEase and custom lyrics all came back empty.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.6f),
                            )
                            Spacer(Modifier.height(Spacing.md))
                            MeloTextButton("Try again") { vm.retry(track) }
                        }
                    }
                    is LyricsUi.Failed -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(state.message, style = MaterialTheme.typography.titleMedium, color = Color.White)
                            Spacer(Modifier.height(Spacing.md))
                            MeloTextButton("Retry") { vm.retry(track) }
                        }
                    }
                    is LyricsUi.Ready -> LyricsBody(
                        doc = state.doc,
                        mode = mode,
                        position = position,
                        app = app,
                        reducedMotion = reducedMotion,
                        fontSize = settings.lyricsTextSize.sp,
                        fontFamily = lyricsFamily(settings.lyricsFont),
                        center = settings.lyricsAlignCenter,
                        lineSpacing = settings.lyricsLineSpacing.dp,
                        karaoke = settings.lyricsWordKaraoke,
                        autoScroll = settings.lyricsAutoScroll,
                    )
                }
            }

            // Offset controls: nudge sync, like the desktop lyrics offset.
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                CircleIconButton(
                    Icons.Rounded.Remove,
                    "Lyrics 0.5s earlier",
                    onClick = { app.setLyricsOffset(settings.lyricsOffsetMs - 500) },
                    tint = Color.White.copy(alpha = 0.7f),
                )
                Text(
                    if (settings.lyricsOffsetMs == 0) "in sync"
                    else "${if (settings.lyricsOffsetMs > 0) "+" else ""}${settings.lyricsOffsetMs / 1000.0}s",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.7f),
                    modifier = Modifier.padding(horizontal = Spacing.md),
                )
                CircleIconButton(
                    Icons.Rounded.Add,
                    "Lyrics 0.5s later",
                    onClick = { app.setLyricsOffset(settings.lyricsOffsetMs + 500) },
                    tint = Color.White.copy(alpha = 0.7f),
                )
                Spacer(Modifier.width(Spacing.md))
                Text(
                    when (doc?.source?.id) {
                        "lrclib" -> "LRCLIB"
                        "netease" -> "NetEase"
                        "custom" -> "Custom"
                        else -> ""
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.45f),
                )
            }
        }
    }
}

@Composable
private fun ModeChip(label: String, onClick: () -> Unit) {
    Text(
        label,
        style = MaterialTheme.typography.labelLarge,
        color = Color.White,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.14f))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
    )
}

@Composable
private fun LyricsBody(
    doc: LyricDocument,
    mode: LyricsMode,
    position: Long,
    app: AppViewModel,
    reducedMotion: Boolean,
    fontSize: androidx.compose.ui.unit.TextUnit,
    fontFamily: androidx.compose.ui.text.font.FontFamily,
    center: Boolean,
    lineSpacing: androidx.compose.ui.unit.Dp,
    karaoke: Boolean,
    autoScroll: Boolean,
) {
    when (mode) {
        LyricsMode.PLAIN -> PlainLyrics(doc, fontSize, fontFamily, center, lineSpacing)
        LyricsMode.LINE, LyricsMode.WORD -> SyncedLyrics(
            doc = doc,
            mode = mode,
            position = position,
            reducedMotion = reducedMotion,
            fontSize = fontSize,
            fontFamily = fontFamily,
            center = center,
            lineSpacing = lineSpacing,
            karaoke = karaoke,
            autoScroll = autoScroll,
            onSeek = { app.playback.seekTo(it) },
        )
    }
}

@Composable
private fun PlainLyrics(
    doc: LyricDocument,
    fontSize: androidx.compose.ui.unit.TextUnit,
    fontFamily: androidx.compose.ui.text.font.FontFamily,
    center: Boolean,
    lineSpacing: androidx.compose.ui.unit.Dp,
) {
    val text = doc.plain.ifBlank { doc.lines.joinToString("\n") { it.text } }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.xl, vertical = Spacing.lg),
    ) {
        Text(
            text,
            style = MaterialTheme.typography.bodyLarge.copy(
                fontSize = fontSize,
                lineHeight = fontSize * (1.55f + lineSpacing.value / 100f),
                fontFamily = fontFamily,
            ),
            color = Color.White.copy(alpha = 0.92f),
            textAlign = if (center) TextAlign.Center else TextAlign.Start,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(80.dp))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SyncedLyrics(
    doc: LyricDocument,
    mode: LyricsMode,
    position: Long,
    reducedMotion: Boolean,
    fontSize: androidx.compose.ui.unit.TextUnit,
    fontFamily: androidx.compose.ui.text.font.FontFamily,
    center: Boolean,
    lineSpacing: androidx.compose.ui.unit.Dp,
    karaoke: Boolean,
    autoScroll: Boolean,
    onSeek: (Long) -> Unit,
) {
    val lines = doc.lines
    val listState = rememberLazyListState()
    val activeIndex = LyricsSync.activeLine(lines, position)
    val isDragged by listState.interactionSource.collectIsDraggedAsState()
    var follow by remember { mutableStateOf(true) }

    // Pause auto-follow while the user scrolls, resume a few seconds later.
    LaunchedEffect(isDragged) {
        if (isDragged) {
            follow = false
        } else {
            delay(3_500)
            follow = true
        }
    }

    LaunchedEffect(activeIndex, follow, autoScroll) {
        if (follow && autoScroll && activeIndex >= 0 && !isDragged) {
            val target = (activeIndex - 2).coerceAtLeast(0)
            if (reducedMotion) listState.scrollToItem(target)
            else listState.animateScrollToItem(target)
        }
    }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(horizontal = Spacing.xl, vertical = 80.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            itemsIndexed(lines, key = { i, line -> "$i-${line.startMs}" }) { index, line ->
                val distance = kotlin.math.abs(index - activeIndex)
                val active = index == activeIndex
                val lineAlpha = when {
                    active -> 1f
                    distance == 1 -> 0.55f
                    distance == 2 -> 0.38f
                    else -> 0.24f
                }
                val scale by animateFloatAsState(
                    targetValue = if (active && !reducedMotion) 1f else 0.97f,
                    animationSpec = tween(260),
                    label = "line-scale",
                )
                val color by animateColorAsState(
                    targetValue = if (active) MaterialTheme.colorScheme.primary else Color.White.copy(alpha = lineAlpha),
                    animationSpec = tween(220),
                    label = "line-color",
                )

                Box(
                    Modifier
                        .fillMaxWidth()
                        .clickable { if (line.startMs >= 0) onSeek(line.startMs) }
                        .padding(vertical = 5.dp),
                ) {
                    if (mode == LyricsMode.WORD && line.words.isNotEmpty()) {
                        FlowRow(
                            modifier = Modifier
                                .fillMaxWidth()
                                .graphicsLayer { scaleX = scale; scaleY = scale },
                            horizontalArrangement = if (center) Arrangement.Center else Arrangement.Start,
                        ) {
                            val activeWord = if (active) LyricsSync.activeWord(line, position) else -1
                            line.words.forEachIndexed { wIndex, word ->
                                val isActiveWord = wIndex == activeWord
                                val progress = if (isActiveWord) LyricsSync.wordProgress(word, position) else 0f
                                val wordColor by animateColorAsState(
                                    targetValue = when {
                                        isActiveWord && karaoke -> MaterialTheme.colorScheme.primary
                                        isActiveWord -> Color.White
                                        active -> Color.White.copy(alpha = 0.72f)
                                        else -> Color.White.copy(alpha = lineAlpha)
                                    },
                                    animationSpec = tween(140),
                                    label = "word-color",
                                )
                                val wordScale by animateFloatAsState(
                                    targetValue = if (isActiveWord && karaoke && !reducedMotion) 1.06f else 1f,
                                    animationSpec = tween(140),
                                    label = "word-scale",
                                )
                                Text(
                                    text = word.text,
                                    style = MaterialTheme.typography.bodyLarge.copy(
                                        fontSize = fontSize,
                                        fontFamily = fontFamily,
                                        fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                                        lineHeight = fontSize * (1.35f + lineSpacing.value / 100f),
                                    ),
                                    color = wordColor,
                                    modifier = Modifier
                                        .padding(end = 6.dp)
                                        .graphicsLayer {
                                            scaleX = wordScale
                                            scaleY = wordScale
                                            this.alpha = if (isActiveWord && karaoke) {
                                                0.65f + 0.35f * progress.coerceIn(0f, 1f)
                                            } else 1f
                                        },
                                )
                            }
                        }
                    } else {
                        Text(
                            text = line.text,
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontSize = fontSize,
                                fontFamily = fontFamily,
                                fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                                lineHeight = fontSize * (1.35f + lineSpacing.value / 100f),
                            ),
                            color = color,
                            textAlign = if (center) TextAlign.Center else TextAlign.Start,
                            modifier = Modifier
                                .fillMaxWidth()
                                .graphicsLayer { scaleX = scale; scaleY = scale },
                        )
                        if (active && line.words.isEmpty() && lines[index].endMs > line.startMs) {
                            // Line-level progress bar for line-by-line mode.
                            val progress = LyricsSync.lineProgress(line, position)
                            Box(
                                Modifier
                                    .padding(top = 6.dp)
                                    .fillMaxWidth(0.35f)
                                    .height(2.dp)
                                    .clip(RoundedCornerShape(2.dp))
                                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.35f))
                                    .graphicsLayer { scaleX = progress; transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0.5f) },
                            )
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(120.dp)) }
        }

        if (!follow) {
            Row(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = Spacing.lg)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.Black.copy(alpha = 0.55f))
                    .clickable { follow = true }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.PlayArrow, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Follow along", style = MaterialTheme.typography.labelSmall, color = Color.White)
            }
        }
    }
}
