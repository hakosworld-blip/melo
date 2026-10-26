package app.melo.player.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.melo.player.data.model.Album
import app.melo.player.data.model.ArtistPage
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LoadingRow
import app.melo.player.ui.components.LocalCurrentTrack
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.SectionHeader
import app.melo.player.ui.components.TrackRow
import app.melo.player.ui.components.formatCount
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ArtistViewModel(private val name: String) : ViewModel() {
    private val music = ServiceLocator.music
    private val library = ServiceLocator.library

    private val _page = MutableStateFlow<ArtistPage?>(null)
    val page: StateFlow<ArtistPage?> = _page.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()

    val following = library.isFollowing(name).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _loading.value = true
            _error.value = null
            runCatching { music.artistPage(name) }
                .onSuccess { _page.value = it }
                .onFailure { _error.value = "Could not load this artist." }
            _loading.value = false
        }
    }

    fun toggleFollow() {
        val page = _page.value ?: return
        viewModelScope.launch {
            library.toggleFollow(
                artistName = name,
                artwork = page.artist.artwork,
                listeners = page.artist.monthlyListeners,
            )
        }
    }

    companion object {
        fun factory(name: String) = viewModelFactory { initializer { ArtistViewModel(name) } }
    }
}

@Composable
fun ArtistScreen(
    name: String,
    onBack: () -> Unit,
    onOpenAlbum: (Album) -> Unit,
    onOpenArtist: (String) -> Unit,
    onPlay: (List<Track>, Int) -> Unit,
) {
    val vm: ArtistViewModel = viewModel(key = "artist-$name", factory = ArtistViewModel.factory(name))
    val page by vm.page.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val error by vm.error.collectAsStateWithLifecycle()
    val following by vm.following.collectAsStateWithLifecycle()
    val actions = LocalTrackActions.current
    val current = LocalCurrentTrack.current
    val settings by ServiceLocator.settings.settings.collectAsStateWithLifecycle(initialValue = app.melo.player.data.prefs.Settings())
    var bioExpanded by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        page?.artist?.artwork?.takeIf { it.isNotBlank() }?.let { art ->
            AsyncImage(
                model = art,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alpha = 0.35f,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp)
                    .blur(48.dp),
            )
        }

        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Row(Modifier.padding(horizontal = 6.dp, vertical = Spacing.sm)) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Rounded.ArrowBack, contentDescription = "Back")
                    }
                }
            }

            when {
                loading -> item { LoadingRow("Loading artist") }
                error != null -> item {
                    EmptyState(
                        title = "Artist unavailable",
                        message = error ?: "",
                        action = { app.melo.player.ui.components.MeloTextButton("Retry", { vm.load() }) },
                    )
                }
                page != null -> {
                    val p = page!!
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = Spacing.screenH),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            MeloArt(
                                p.artist.artwork,
                                Modifier.size(150.dp),
                                circular = true,
                                contentDescription = "${p.artist.name} photo",
                            )
                            Spacer(Modifier.height(Spacing.md))
                            Text(
                                p.artist.name,
                                style = MaterialTheme.typography.headlineLarge,
                                textAlign = TextAlign.Center,
                            )
                            if (p.artist.monthlyListeners > 0 && settings.showStatsSource) {
                                Text(
                                    "${formatCount(p.artist.monthlyListeners)} monthly listeners · YouTube Music",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LocalMeloColors.current.textSecondary,
                                    textAlign = TextAlign.Center,
                                )
                            } else if (p.artist.verified) {
                                Text(
                                    "Verified artist",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = LocalMeloColors.current.textSecondary,
                                )
                            }
                            Spacer(Modifier.height(Spacing.md))
                            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(
                                            if (following) LocalMeloColors.current.surfaceElevated
                                            else MaterialTheme.colorScheme.primary,
                                        )
                                        .clickable { vm.toggleFollow() }
                                        .padding(horizontal = 16.dp, vertical = 10.dp),
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            if (following) Icons.Rounded.Check else Icons.Rounded.PersonAdd,
                                            contentDescription = null,
                                            tint = if (following) LocalMeloColors.current.textPrimary
                                            else MaterialTheme.colorScheme.onPrimary,
                                            modifier = Modifier.size(17.dp),
                                        )
                                        Spacer(Modifier.width(6.dp))
                                        Text(
                                            if (following) "Following" else "Follow",
                                            style = MaterialTheme.typography.labelLarge,
                                            color = if (following) LocalMeloColors.current.textPrimary
                                            else MaterialTheme.colorScheme.onPrimary,
                                        )
                                    }
                                }
                                RoundButton(Icons.Rounded.PlayArrow, "Play top songs", primary = true) {
                                    if (p.topTracks.isNotEmpty()) onPlay(p.topTracks, 0)
                                }
                                RoundButton(Icons.Rounded.Shuffle, "Shuffle top songs") {
                                    if (p.topTracks.isNotEmpty()) onPlay(p.topTracks.shuffled(), 0)
                                }
                            }
                        }
                    }

                    if (p.artist.bio.isNotBlank()) {
                        item {
                            Column(Modifier.padding(horizontal = Spacing.screenH, vertical = Spacing.md)) {
                                Text(
                                    p.artist.bio,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = LocalMeloColors.current.textSecondary,
                                    maxLines = if (bioExpanded) 100 else 3,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    if (bioExpanded) "Show less" else "Read more",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier
                                        .padding(top = 6.dp)
                                        .clickable { bioExpanded = !bioExpanded },
                                )
                            }
                        }
                    }

                    if (p.topTracks.isNotEmpty()) {
                        item { SectionHeader("Popular", "On YouTube Music") }
                        itemsIndexed(p.topTracks.take(10), key = { _, t -> t.key }) { index, track ->
                            TrackRow(
                                track = track,
                                isActive = current?.key == track.key,
                                onClick = { onPlay(p.topTracks, p.topTracks.indexOf(track)) },
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

                    if (p.albums.isNotEmpty()) {
                        item { SectionHeader("Albums") }
                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = Spacing.screenH),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                            ) {
                                items(p.albums, key = { it.id + it.title }) { album ->
                                    AlbumTile(album) { onOpenAlbum(album) }
                                }
                            }
                        }
                    }

                    if (p.singles.isNotEmpty()) {
                        item { SectionHeader("Singles") }
                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = Spacing.screenH),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                            ) {
                                items(p.singles, key = { it.id + it.title }) { album ->
                                    AlbumTile(album) { onOpenAlbum(album) }
                                }
                            }
                        }
                    }

                    if (p.related.isNotEmpty()) {
                        item { SectionHeader("Fans also like") }
                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = Spacing.screenH),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
                            ) {
                                items(p.related, key = { it.name }) { artist ->
                                    Column(
                                        modifier = Modifier
                                            .width(96.dp)
                                            .clip(RoundedCornerShape(16.dp))
                                            .clickable { onOpenArtist(artist.name) },
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                    ) {
                                        MeloArt(artist.artwork, Modifier.size(88.dp), circular = true)
                                        Spacer(Modifier.height(6.dp))
                                        Text(
                                            artist.name,
                                            style = MaterialTheme.typography.bodySmall,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    item { Spacer(Modifier.height(90.dp)) }
                }
            }
        }
    }
}

@Composable
private fun AlbumTile(album: Album, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(142.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
    ) {
        MeloArt(album.artwork, Modifier.size(142.dp), corner = MeloTheme.radius)
        Spacer(Modifier.height(6.dp))
        Text(album.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            listOfNotNull(album.year.takeIf { it.isNotBlank() }, album.trackCount.takeIf { it > 0 }?.let { "$it tracks" })
                .joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = LocalMeloColors.current.textSecondary,
        )
    }
}

@Composable
fun CircularLoader() {
    Box(Modifier.fillMaxWidth().padding(Spacing.lg), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
    }
}
