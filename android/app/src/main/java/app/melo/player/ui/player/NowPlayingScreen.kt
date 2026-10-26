package app.melo.player.ui.player

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.Lyrics
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.RepeatOne
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.CircleIconButton
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.formatDuration
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing

@Composable
fun NowPlayingScreen(
    app: AppViewModel,
    onClose: () -> Unit,
    onOpenLyrics: () -> Unit,
    onOpenQueue: () -> Unit,
    onOpenArtist: (String) -> Unit,
    onOpenAlbum: (Track) -> Unit,
) {
    val state by app.playback.state.collectAsStateWithLifecycle()
    val settings by app.settings.collectAsStateWithLifecycle()
    val actions = LocalTrackActions.current
    val track = state.current

    var isFavorite by remember(track?.key) { mutableStateOf(false) }
    var scrub by remember(track?.key) { mutableStateOf<Float?>(null) }

    LaunchedEffect(track?.key) {
        isFavorite = track?.let { ServiceLocator.library.isFavorite(it.key) } ?: false
    }

    val accent = MaterialTheme.colorScheme.primary
    val bg = MaterialTheme.colorScheme.background

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        accent.copy(alpha = 0.22f),
                        bg.copy(alpha = 0.85f),
                        bg,
                    ),
                ),
            ),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .padding(horizontal = Spacing.screenH),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircleIconButton(Icons.Rounded.KeyboardArrowDown, "Close player", onClick = onClose)
                Column(
                    Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "now playing",
                        style = MaterialTheme.typography.labelSmall,
                        color = LocalMeloColors.current.textSecondary,
                    )
                    Text(
                        if (state.queue.isEmpty()) "" else "${state.index + 1} of ${state.queue.size}",
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalMeloColors.current.textSecondary,
                    )
                }
                CircleIconButton(Icons.Rounded.MoreVert, "Track options") {
                    track?.let { actions.show(it) }
                }
            }

            Spacer(Modifier.height(Spacing.md))

            MeloArt(
                url = track?.artwork,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .shadow(24.dp, RoundedCornerShape(MeloTheme.radius))
                    .clip(RoundedCornerShape(MeloTheme.radius)),
                corner = MeloTheme.radius,
                contentDescription = "Album artwork",
            )

            Spacer(Modifier.height(Spacing.xl))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(
                    Modifier
                        .weight(1f)
                        .clickable { track?.artist?.let(onOpenArtist) },
                ) {
                    Text(
                        track?.title ?: "Nothing playing",
                        style = MaterialTheme.typography.headlineMedium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        listOfNotNull(track?.artist, track?.album?.takeIf { it.isNotBlank() }).joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                CircleIconButton(
                    icon = if (isFavorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                    description = if (isFavorite) "Remove from favourites" else "Add to favourites",
                    tint = if (isFavorite) MaterialTheme.colorScheme.primary else LocalMeloColors.current.textSecondary,
                ) {
                    track?.let {
                        actions.toggleFavorite(it)
                        isFavorite = !isFavorite
                    }
                }
            }

            Spacer(Modifier.height(Spacing.md))

            val duration = state.durationMs.takeIf { it > 0 } ?: (track?.durationMs ?: 0L)
            val position = (scrub?.times(duration)?.toLong() ?: state.positionMs).coerceIn(0L, maxOf(duration, 1L))
            Slider(
                value = if (duration > 0) position.toFloat() / duration else 0f,
                onValueChange = { scrub = it },
                onValueChangeFinished = {
                    val d = state.durationMs.takeIf { it > 0 } ?: (track?.durationMs ?: 0L)
                    scrub?.let { if (d > 0) app.playback.seekTo((it * d).toLong()) }
                    scrub = null
                },
                colors = SliderDefaults.colors(
                    thumbColor = MaterialTheme.colorScheme.primary,
                    activeTrackColor = MaterialTheme.colorScheme.primary,
                    inactiveTrackColor = LocalMeloColors.current.outlineSoft,
                ),
            )
            Row(Modifier.fillMaxWidth()) {
                Text(
                    formatDuration(position),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalMeloColors.current.textSecondary,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "-" + formatDuration((duration - position).coerceAtLeast(0L)),
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalMeloColors.current.textSecondary,
                )
            }

            Spacer(Modifier.height(Spacing.sm))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ToggleIcon(
                    icon = Icons.Rounded.Shuffle,
                    active = state.shuffle,
                    description = "Shuffle",
                ) { app.setShuffle(!state.shuffle) }

                CircleIconButton(
                    Icons.Rounded.SkipPrevious,
                    "Previous",
                    onClick = { app.playback.previous() },
                    tint = LocalMeloColors.current.textPrimary,
                )

                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                        .clickable { app.playback.toggle() },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (state.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                        contentDescription = if (state.isPlaying) "Pause" else "Play",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(34.dp),
                    )
                }

                CircleIconButton(
                    Icons.Rounded.SkipNext,
                    "Next",
                    onClick = { app.playback.next() },
                    tint = LocalMeloColors.current.textPrimary,
                )

                ToggleIcon(
                    icon = if (state.repeatMode == 2) Icons.Rounded.RepeatOne else Icons.Rounded.Repeat,
                    active = state.repeatMode != 0,
                    description = "Repeat",
                ) {
                    app.setRepeat((state.repeatMode + 1) % 3)
                }
            }

            Spacer(Modifier.height(Spacing.lg))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PillAction(Icons.Rounded.Lyrics, "Lyrics", enabled = settings.lyricsMode != "off", onClick = onOpenLyrics)
                PillAction(Icons.Rounded.QueueMusic, "Queue", onClick = onOpenQueue)
                PillAction(Icons.Rounded.Download, "Download") {
                    track?.let { actions.download(it) }
                }
            }

            Spacer(Modifier.weight(1f))

            if (track != null) {
                Text(
                    "Tap the artist name for their page",
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalMeloColors.current.textSecondary.copy(alpha = 0.7f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenAlbum(track) }
                        .padding(bottom = Spacing.sm),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun ToggleIcon(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean,
    description: String,
    onClick: () -> Unit,
) {
    val tint by animateColorAsState(
        if (active) MaterialTheme.colorScheme.primary else LocalMeloColors.current.textSecondary,
        label = "toggle-tint",
    )
    CircleIconButton(icon, description, tint = tint, onClick = onClick)
}

@Composable
private fun PillAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            icon,
            contentDescription = label,
            tint = if (enabled) LocalMeloColors.current.textSecondary else LocalMeloColors.current.outlineSoft,
            modifier = Modifier.size(20.dp),
        )
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = if (enabled) LocalMeloColors.current.textSecondary else LocalMeloColors.current.outlineSoft,
        )
    }
}
