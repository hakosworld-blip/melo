package app.melo.player.ui.library

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.History
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.ConfirmDialog
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.components.TrackRow
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.launch

@Composable
fun HistoryScreen(
    app: AppViewModel,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val history by ServiceLocator.library.history.collectAsStateWithLifecycle(initialValue = emptyList())
    val actions = LocalTrackActions.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var confirmClear by remember { mutableStateOf(false) }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader(
                "history",
                onBack = onBack,
                subtitle = if (settings.historyEnabled) "${history.size} tracks" else "History is off",
                trailing = {
                    if (history.isNotEmpty()) {
                        MeloTextButton("Clear", { confirmClear = true })
                    }
                },
            )

            if (history.isEmpty()) {
                EmptyState(
                    title = "Nothing played yet",
                    message = if (settings.historyEnabled) {
                        "Songs you play will show up here."
                    } else {
                        "Turn listening history back on in Settings → Privacy."
                    },
                    icon = Icons.Rounded.History,
                )
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(history, key = { it.key }) { track ->
                        TrackRow(
                            track = track,
                            isActive = playback.current?.key == track.key,
                            onClick = { onPlay(history, history.indexOf(track)) },
                            trailing = { OverflowButton { actions.show(track) } },
                        )
                    }
                    item { Spacer(Modifier.height(60.dp)) }
                }
            }
        }
    }

    if (confirmClear) {
        ConfirmDialog(
            title = "Clear listening history?",
            message = "This removes your play history and the recommendations built from it. Favourites and playlists stay.",
            confirmLabel = "Clear history",
            onConfirm = { scope.launch { ServiceLocator.library.clearHistory() } },
            onDismiss = { confirmClear = false },
        )
    }
}
