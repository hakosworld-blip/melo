package app.melo.player.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material3.Icon
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
import app.melo.player.data.prefs.Settings
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.CircleIconButton
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import androidx.compose.material.icons.rounded.QueueMusic

@Composable
fun QueueScreen(app: AppViewModel, onClose: () -> Unit) {
    val state by app.playback.state.collectAsStateWithLifecycle()
    val settings by ServiceLocator.settings.settings
        .collectAsStateWithLifecycle(initialValue = Settings())
    var confirmClear by remember { mutableStateOf(false) }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = state.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader(
                "queue",
                onBack = onClose,
                subtitle = "${state.queue.size} tracks · ${if (state.shuffle) "shuffled" else "in order"}",
                trailing = {
                    if (state.queue.isNotEmpty()) {
                        MeloTextButton("Clear", { confirmClear = true })
                    }
                },
            )

            if (state.queue.isEmpty()) {
                EmptyState(
                    title = "Queue is empty",
                    message = "Play something, or add songs with \"Play next\" and \"Add to queue\".",
                    icon = Icons.Rounded.QueueMusic,
                )
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    itemsIndexed(state.queue, key = { i, t -> "${t.key}-$i" }) { index, track ->
                        val active = index == state.index
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { app.playback.playQueueIndex(index) }
                                .background(
                                    if (active) MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
                                    else androidx.compose.ui.graphics.Color.Transparent,
                                )
                                .padding(horizontal = Spacing.screenH, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (active) {
                                Icon(
                                    Icons.Rounded.GraphicEq,
                                    contentDescription = "Now playing",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(18.dp),
                                )
                                Spacer(Modifier.width(Spacing.sm))
                            } else {
                                Text(
                                    "${index + 1}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LocalMeloColors.current.textSecondary,
                                    modifier = Modifier.width(26.dp),
                                )
                            }
                            MeloArt(track.artwork, Modifier.size(42.dp), corner = 10.dp)
                            Spacer(Modifier.width(Spacing.md))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    track.title,
                                    style = MaterialTheme.typography.titleMedium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = if (active) MaterialTheme.colorScheme.primary else LocalMeloColors.current.textPrimary,
                                )
                                Text(
                                    track.artist,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LocalMeloColors.current.textSecondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                            CircleIconButton(Icons.Rounded.ArrowUpward, "Move up") {
                                app.playback.moveQueueItem(index, index - 1)
                            }
                            CircleIconButton(Icons.Rounded.ArrowDownward, "Move down") {
                                app.playback.moveQueueItem(index, index + 1)
                            }
                            CircleIconButton(Icons.Rounded.Close, "Remove from queue") {
                                app.playback.removeQueueItem(index)
                            }
                        }
                    }
                    item { Spacer(Modifier.height(60.dp)) }
                }
            }
        }
    }

    if (confirmClear) {
        ConfirmDialog(
            title = "Clear the queue?",
            message = "Playback stops and the queue is emptied. Your library is untouched.",
            confirmLabel = "Clear queue",
            onConfirm = {
                app.playback.clearQueue()
                app.playback.stop()
            },
            onDismiss = { confirmClear = false },
        )
    }
}
