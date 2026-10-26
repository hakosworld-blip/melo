package app.melo.player.ui.detail

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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.melo.player.data.model.Album
import app.melo.player.data.model.AlbumPage
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

class AlbumViewModel(private val album: Album) : ViewModel() {
    private val _page = MutableStateFlow<AlbumPage?>(null)
    val page: StateFlow<AlbumPage?> = _page.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _loading.value = true
            _page.value = runCatching { ServiceLocator.music.albumPage(album) }.getOrNull()
            _loading.value = false
        }
    }

    fun saveAsPlaylist(name: String, onCreate: (Long) -> Unit) {
        viewModelScope.launch {
            val tracks = _page.value?.tracks.orEmpty()
            if (tracks.isEmpty()) return@launch
            val id = ServiceLocator.library.createPlaylist(name)
            ServiceLocator.library.addAllToPlaylist(id, tracks)
            onCreate(id)
        }
    }

    companion object {
        fun factory(album: Album) = viewModelFactory { initializer { AlbumViewModel(album) } }
    }
}

@Composable
fun AlbumScreen(
    album: Album,
    onBack: () -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
    onOpenArtist: (String) -> Unit,
) {
    val vm: AlbumViewModel = viewModel(key = "album-${album.id}-${album.title}", factory = AlbumViewModel.factory(album))
    val page by vm.page.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val current = LocalCurrentTrack.current
    val actions = LocalTrackActions.current
    val scope = rememberCoroutineScope()

    val resolved = page?.album ?: album
    val tracks = page?.tracks.orEmpty()

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
                    MeloArt(resolved.artwork, Modifier.size(132.dp), corner = MeloTheme.radius)
                    Spacer(Modifier.width(Spacing.lg))
                    Column(Modifier.weight(1f)) {
                        Text(
                            resolved.title,
                            style = MaterialTheme.typography.headlineMedium,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            resolved.artist,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary,
                            maxLines = 1,
                            modifier = Modifier.clickable { onOpenArtist(resolved.artist) },
                        )
                        Text(
                            listOfNotNull(
                                resolved.year.takeIf { it.isNotBlank() },
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
                    RoundButton(Icons.Rounded.PlayArrow, "Play album", primary = true) {
                        if (tracks.isNotEmpty()) onPlay(tracks, 0)
                    }
                    RoundButton(Icons.Rounded.Shuffle, "Shuffle album") {
                        if (tracks.isNotEmpty()) onPlay(tracks.shuffled(), 0)
                    }
                    RoundButton(Icons.Rounded.Download, "Download album") {
                        scope.launch { tracks.forEach { ServiceLocator.downloads.enqueue(it) } }
                    }
                    if (tracks.isNotEmpty()) {
                        MeloTextButton("Save as playlist") {
                            vm.saveAsPlaylist(resolved.title) { }
                        }
                    }
                }
            }

            when {
                loading -> item { LoadingRow("Loading album") }
                tracks.isEmpty() -> item {
                    EmptyState(
                        title = "No track list available",
                        message = "This album exists in the catalog but its tracks could not be loaded. Try again from search.",
                        action = { MeloTextButton("Reload", { vm.load() }) },
                    )
                }
                else -> itemsIndexed(tracks, key = { _, t -> t.key }) { index, track ->
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
                    "Track data comes from the provider; melo does not invent missing metadata.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                    modifier = Modifier.padding(horizontal = Spacing.screenH),
                )
                Spacer(Modifier.height(80.dp))
            }
        }
    }
}

@Composable
private fun StatPill(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = LocalMeloColors.current.textSecondary,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(LocalMeloColors.current.surfaceElevated)
            .padding(horizontal = 7.dp, vertical = 3.dp),
    )
}
