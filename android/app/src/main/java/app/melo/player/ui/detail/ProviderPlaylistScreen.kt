package app.melo.player.ui.detail

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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.melo.player.data.model.SearchPlaylist
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LoadingRow
import app.melo.player.ui.components.LocalCurrentTrack
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.TrackRow
import app.melo.player.ui.components.formatDuration
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ProviderPlaylistViewModel(private val playlist: SearchPlaylist?) : ViewModel() {
    private val _tracks = MutableStateFlow<List<Track>>(emptyList())
    val tracks: StateFlow<List<Track>> = _tracks.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _loading.value = true
            _tracks.value = playlist?.let {
                runCatching { ServiceLocator.music.providerPlaylist(it.id) }.getOrDefault(emptyList())
            }.orEmpty()
            _loading.value = false
        }
    }

    fun saveToLibrary(name: String) {
        viewModelScope.launch {
            if (_tracks.value.isEmpty()) return@launch
            val id = ServiceLocator.library.createPlaylist(name)
            ServiceLocator.library.addAllToPlaylist(id, _tracks.value)
        }
    }

    companion object {
        fun factory(playlist: SearchPlaylist?) =
            viewModelFactory { initializer { ProviderPlaylistViewModel(playlist) } }
    }
}

@Composable
fun ProviderPlaylistScreen(
    playlist: SearchPlaylist?,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
) {
    val vm: ProviderPlaylistViewModel = viewModel(
        key = "pp-${playlist?.id}",
        factory = ProviderPlaylistViewModel.factory(playlist),
    )
    val tracks by vm.tracks.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val current = LocalCurrentTrack.current
    val actions = LocalTrackActions.current

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.padding(horizontal = 6.dp, vertical = Spacing.sm)) {
            IconButton(onClick = onBack) {
                Icon(Icons.Rounded.ArrowBack, contentDescription = "Back")
            }
        }

        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.screenH),
                    verticalAlignment = Alignment.Bottom,
                ) {
                    MeloArt(playlist?.artwork.orEmpty(), Modifier.size(120.dp), corner = MeloTheme.radius)
                    Spacer(Modifier.width(Spacing.lg))
                    Column(Modifier.weight(1f)) {
                        Text(
                            playlist?.title ?: "Playlist",
                            style = MaterialTheme.typography.headlineMedium,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            listOfNotNull(
                                playlist?.owner?.takeIf { it.isNotBlank() },
                                tracks.size.takeIf { it > 0 }?.let { "$it tracks" },
                                tracks.sumOf { it.durationMs }.takeIf { it > 0 }?.let { formatDuration(it) },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = LocalMeloColors.current.textSecondary,
                        )
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.padding(horizontal = Spacing.screenH, vertical = Spacing.md),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RoundButton(Icons.Rounded.PlayArrow, "Play playlist", primary = true) {
                        if (tracks.isNotEmpty()) onPlay(tracks, 0)
                    }
                    RoundButton(Icons.Rounded.Shuffle, "Shuffle playlist") {
                        if (tracks.isNotEmpty()) onPlay(tracks.shuffled(), 0)
                    }
                    if (tracks.isNotEmpty()) {
                        MeloTextButton("Save to library") {
                            vm.saveToLibrary(playlist?.title ?: "Imported playlist")
                        }
                    }
                }
            }

            when {
                loading -> item { LoadingRow("Loading playlist") }
                tracks.isEmpty() -> item {
                    EmptyState(
                        title = "Playlist unavailable",
                        message = "This playlist could not be read from the provider. It may be private or region-locked.",
                        action = { MeloTextButton("Retry", { vm.load() }) },
                    )
                }
                else -> itemsIndexed(tracks, key = { i, t -> "${t.key}-$i" }) { index, track ->
                    TrackRow(
                        track = track,
                        isActive = current?.key == track.key,
                        onClick = { onPlay(tracks, index) },
                        leading = {
                            Text(
                                "${index + 1}",
                                style = MaterialTheme.typography.bodySmall,
                                color = LocalMeloColors.current.textSecondary,
                            )
                        },
                        trailing = { OverflowButton { actions.show(track) } },
                    )
                }
            }

            item {
                Spacer(Modifier.height(Spacing.md))
                Text(
                    "Provider playlist. Saving a copy keeps it in your own library.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                    modifier = Modifier.padding(horizontal = Spacing.screenH),
                )
                Spacer(Modifier.height(80.dp))
            }
        }
    }
}
