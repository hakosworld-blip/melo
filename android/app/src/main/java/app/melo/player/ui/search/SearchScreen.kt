package app.melo.player.ui.search

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.melo.player.data.model.Album
import app.melo.player.data.model.SearchPlaylist
import app.melo.player.data.model.SearchResults
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.EmptyState
import app.melo.player.ui.components.LocalTrackActions
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.OverflowButton
import app.melo.player.ui.components.TrackRow
import app.melo.player.ui.components.formatCount
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class SearchFilter(val label: String) {
    ALL("All"), SONGS("Songs"), ARTISTS("Artists"), ALBUMS("Albums"), PLAYLISTS("Playlists")
}

class SearchViewModel : ViewModel() {
    private val music = ServiceLocator.music
    private val library = ServiceLocator.library

    private val _query = MutableStateFlow("")
    val query = _query.asStateFlow()

    private val _results = MutableStateFlow(SearchResults())
    val results = _results.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading = _loading.asStateFlow()

    private val _suggestions = MutableStateFlow<List<String>>(emptyList())
    val suggestions = _suggestions.asStateFlow()

    private val _filter = MutableStateFlow(SearchFilter.ALL)
    val filter = _filter.asStateFlow()

    val recent = library.recentSearches.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private var searchJob: Job? = null
    private var suggestJob: Job? = null

    fun setFilter(f: SearchFilter) {
        _filter.value = f
    }

    fun onQueryChange(value: String) {
        _query.value = value
        searchJob?.cancel()
        suggestJob?.cancel()

        if (value.isBlank()) {
            _results.value = SearchResults()
            _suggestions.value = emptyList()
            _loading.value = false
            return
        }

        suggestJob = viewModelScope.launch {
            delay(180)
            _suggestions.value = runCatching { music.suggestions(value) }.getOrDefault(emptyList())
        }

        searchJob = viewModelScope.launch {
            delay(420) // debounce typing; explicit submit searches immediately
            runSearch(value)
        }
    }

    fun submit(value: String = _query.value) {
        searchJob?.cancel()
        viewModelScope.launch { runSearch(value) }
    }

    fun applySuggestion(value: String) {
        _query.value = value
        _suggestions.value = emptyList()
        submit(value)
    }

    private suspend fun runSearch(value: String) {
        if (value.isBlank()) return
        _loading.value = true
        val outcome = runCatching { music.search(value) }
        _loading.value = false
        outcome.onSuccess {
            _results.value = it
            library.addSearch(value)
        }.onFailure {
            _results.value = SearchResults()
        }
    }

    companion object {
        val Factory = viewModelFactory { initializer { SearchViewModel() } }
    }
}

@Composable
fun SearchScreen(
    app: AppViewModel,
    onOpenTrack: (List<Track>, Int) -> Unit,
    onOpenAlbum: (Album) -> Unit,
    onOpenArtist: (String) -> Unit,
    onOpenProviderPlaylist: (SearchPlaylist) -> Unit,
    vm: SearchViewModel = viewModel(factory = SearchViewModel.Factory),
) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    val query by vm.query.collectAsStateWithLifecycle()
    val results by vm.results.collectAsStateWithLifecycle()
    val loading by vm.loading.collectAsStateWithLifecycle()
    val suggestions by vm.suggestions.collectAsStateWithLifecycle()
    val recent by vm.recent.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()
    val actions = LocalTrackActions.current
    val keyboard = LocalSoftwareKeyboardController.current
    val focus = androidx.compose.runtime.remember { FocusRequester() }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize().imePadding()) {
            OutlinedTextField(
                value = query,
                onValueChange = vm::onQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.screenH, vertical = Spacing.md)
                    .focusRequester(focus),
                placeholder = { Text("Songs, artists, albums…") },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                trailingIcon = {
                    if (query.isNotBlank()) {
                        IconButton(onClick = { vm.onQueryChange("") }) {
                            Icon(Icons.Rounded.Close, contentDescription = "Clear search")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(20.dp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = {
                    keyboard?.hide()
                    vm.submit()
                }),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f),
                    unfocusedBorderColor = LocalMeloColors.current.outlineSoft,
                    focusedContainerColor = LocalMeloColors.current.surfaceElevated,
                    unfocusedContainerColor = LocalMeloColors.current.surfaceElevated,
                ),
            )

            LazyRow(
                contentPadding = PaddingValues(horizontal = Spacing.screenH),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                modifier = Modifier.padding(bottom = Spacing.sm),
            ) {
                items(SearchFilter.entries) { f ->
                    FilterPill(f.label, f == filter) { vm.setFilter(f) }
                }
            }

            when {
                query.isBlank() && recent.isNotEmpty() -> {
                    Column(Modifier.padding(horizontal = Spacing.screenH)) {
                        Text(
                            "Recent searches",
                            style = MaterialTheme.typography.titleMedium,
                            color = LocalMeloColors.current.textSecondary,
                            modifier = Modifier.padding(vertical = Spacing.sm),
                        )
                        recent.forEach { term ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { vm.applySuggestion(term) }
                                    .padding(vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Rounded.History,
                                    contentDescription = null,
                                    tint = LocalMeloColors.current.textSecondary,
                                    modifier = Modifier.size(18.dp),
                                )
                                Spacer(Modifier.width(Spacing.md))
                                Text(term, style = MaterialTheme.typography.bodyLarge)
                            }
                        }
                    }
                }

                query.isBlank() -> EmptyState(
                    title = "Search the catalog",
                    message = "Find songs, artists, albums and playlists. Everything plays straight from the providers.",
                )

                loading && results.tracks.isEmpty() -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) { CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(26.dp)) }

                else -> LazyColumn(Modifier.fillMaxSize()) {
                    if (suggestions.isNotEmpty() && query.isNotBlank()) {
                        item {
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = Spacing.screenH),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                            ) {
                                items(suggestions) { s ->
                                    FilterPill(s, false) { vm.applySuggestion(s) }
                                }
                            }
                        }
                    }

                    val showSongs = filter == SearchFilter.ALL || filter == SearchFilter.SONGS
                    val showArtists = filter == SearchFilter.ALL || filter == SearchFilter.ARTISTS
                    val showAlbums = filter == SearchFilter.ALL || filter == SearchFilter.ALBUMS
                    val showPlaylists = filter == SearchFilter.ALL || filter == SearchFilter.PLAYLISTS

                    if (showArtists && results.artists.isNotEmpty()) {
                        item { HeaderText("Artists") }
                        items(results.artists, key = { "a-" + it.name }) { artist ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenArtist(artist.name) }
                                    .padding(horizontal = Spacing.screenH, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                MeloArt(artist.artwork, Modifier.size(46.dp), circular = true)
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(artist.name, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                                    Text(
                                        if (artist.monthlyListeners > 0) "Artist · ${formatCount(artist.monthlyListeners)} monthly listeners" else "Artist",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                    )
                                }
                            }
                        }
                    }

                    if (showAlbums && results.albums.isNotEmpty()) {
                        item { HeaderText("Albums") }
                        items(results.albums, key = { "al-" + it.id }) { album ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenAlbum(album) }
                                    .padding(horizontal = Spacing.screenH, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                MeloArt(album.artwork, Modifier.size(46.dp), corner = 10.dp)
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(album.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(
                                        listOfNotNull(album.artist, album.year.takeIf { it.isNotBlank() }).joinToString(" · "),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                    )
                                }
                            }
                        }
                    }

                    if (showPlaylists && results.playlists.isNotEmpty()) {
                        item { HeaderText("Playlists") }
                        items(results.playlists, key = { "p-" + it.id }) { playlist ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onOpenProviderPlaylist(playlist) }
                                    .padding(horizontal = Spacing.screenH, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                MeloArt(playlist.artwork, Modifier.size(46.dp), corner = 10.dp)
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(playlist.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(
                                        playlist.owner.ifBlank { "Playlist" },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                    )
                                }
                            }
                        }
                    }

                    if (showSongs && results.tracks.isNotEmpty()) {
                        item { HeaderText("Songs") }
                        items(results.tracks, key = { "t-" + it.key }) { track ->
                            TrackRow(
                                track = track,
                                isActive = playback.current?.key == track.key,
                                onClick = { onOpenTrack(results.tracks, results.tracks.indexOf(track)) },
                                trailing = { OverflowButton { actions.show(track) } },
                            )
                        }
                    }

                    if (!loading && results.tracks.isEmpty() && results.artists.isEmpty() &&
                        results.albums.isEmpty() && results.playlists.isEmpty()
                    ) {
                        item {
                            EmptyState(
                                title = "No results",
                                message = "Nothing matched \"$query\". Try a different spelling or a broader search.",
                            )
                        }
                    }

                    item { Spacer(Modifier.height(80.dp)) }
                }
            }
        }
    }
}

@Composable
private fun FilterPill(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        label,
        style = MaterialTheme.typography.labelLarge,
        color = if (selected) MaterialTheme.colorScheme.onPrimary else LocalMeloColors.current.textSecondary,
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) MaterialTheme.colorScheme.primary else LocalMeloColors.current.surfaceElevated)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

@Composable
private fun HeaderText(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleLarge,
        modifier = Modifier.padding(start = Spacing.screenH, top = Spacing.lg, bottom = Spacing.xs),
    )
}
