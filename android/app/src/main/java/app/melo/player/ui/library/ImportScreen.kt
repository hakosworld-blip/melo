package app.melo.player.ui.library

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import app.melo.player.data.remote.SpotifyImport
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.components.MeloArt
import app.melo.player.ui.components.MeloBackground
import app.melo.player.ui.components.MeloTextButton
import app.melo.player.ui.components.ScreenHeader
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.Spacing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed interface ImportStage {
    data object Idle : ImportStage
    data object Fetching : ImportStage
    data class Matching(val done: Int, val total: Int) : ImportStage
    data class Ready(
        val preview: SpotifyImport.Preview,
        val matches: List<SpotifyImport.Match>,
    ) : ImportStage
    data class Failed(val message: String) : ImportStage
    data class Created(val playlistId: Long, val added: Int) : ImportStage
}

class ImportViewModel : ViewModel() {
    private val _stage = MutableStateFlow<ImportStage>(ImportStage.Idle)
    val stage: StateFlow<ImportStage> = _stage.asStateFlow()

    fun import(input: String) {
        val id = SpotifyImport.playlistId(input)
        if (id == null) {
            _stage.value = ImportStage.Failed("That doesn't look like a Spotify playlist link.")
            return
        }
        viewModelScope.launch {
            _stage.value = ImportStage.Fetching
            val preview = SpotifyImport.fetchPlaylist(id).getOrElse { error ->
                _stage.value = ImportStage.Failed(error.message ?: "Could not read that playlist.")
                return@launch
            }
            _stage.value = ImportStage.Matching(0, preview.tracks.size)
            val matches = SpotifyImport.match(preview.tracks) { done, total ->
                _stage.value = ImportStage.Matching(done, total)
            }
            _stage.value = ImportStage.Ready(preview, matches)
        }
    }

    fun createPlaylist(name: String, onlyMatched: Boolean = true) {
        val ready = _stage.value as? ImportStage.Ready ?: return
        viewModelScope.launch {
            val existing = ServiceLocator.library.playlists.first()
                .firstOrNull { it.name.equals(name, ignoreCase = true) }

            val targetId = existing?.id ?: ServiceLocator.library.createPlaylist(name)
            val tracks = ready.matches
                .filter { if (onlyMatched) it.isMatched else true }
                .mapNotNull { it.matched }
            val added = ServiceLocator.library.addAllToPlaylist(targetId, tracks)
            _stage.value = ImportStage.Created(targetId, added)
        }
    }

    companion object {
        val Factory = viewModelFactory { initializer { ImportViewModel() } }
    }
}

@Composable
fun ImportScreen(app: AppViewModel, onBack: () -> Unit, onOpenPlaylist: (Long) -> Unit) {
    val settings by app.settings.collectAsStateWithLifecycle()
    val vm: ImportViewModel = viewModel(factory = ImportViewModel.Factory)
    val stage by vm.stage.collectAsStateWithLifecycle()
    val playback by app.playback.state.collectAsStateWithLifecycle()
    var input by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }

    MeloBackground(
        style = settings.backgroundStyle,
        imageUri = settings.backgroundImageUri,
        artwork = playback.current?.artwork,
        gradient = settings.backgroundGradient,
    ) {
        Column(Modifier.fillMaxSize()) {
            ScreenHeader("import a playlist", onBack = onBack)

            Column(Modifier.padding(horizontal = Spacing.screenH)) {
                Text(
                    "Paste a public Spotify playlist link. melo reads the public track list, then matches each song " +
                        "against the catalog so you can review before saving. Spotify audio is never copied or downloaded.",
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                )
                Spacer(Modifier.height(Spacing.md))
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    placeholder = { Text("https://open.spotify.com/playlist/…") },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(Spacing.sm))
                MeloTextButton(if (stage is ImportStage.Fetching) "Reading…" else "Read playlist") {
                    vm.import(input)
                }
                Spacer(Modifier.height(Spacing.md))
            }

            when (val s = stage) {
                is ImportStage.Idle -> Unit
                is ImportStage.Fetching -> Row(
                    Modifier.fillMaxWidth().padding(Spacing.lg),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(Spacing.sm))
                    Text("Reading playlist…", style = MaterialTheme.typography.bodySmall)
                }
                is ImportStage.Matching -> Column(Modifier.padding(horizontal = Spacing.screenH)) {
                    Text(
                        "Matching ${s.done} of ${s.total} tracks…",
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalMeloColors.current.textSecondary,
                    )
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { if (s.total > 0) s.done.toFloat() / s.total else 0f },
                        modifier = Modifier.fillMaxWidth().height(3.dp),
                    )
                }
                is ImportStage.Failed -> Text(
                    s.message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(Spacing.screenH),
                )
                is ImportStage.Created -> Column(
                    Modifier.fillMaxWidth().padding(Spacing.screenH),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("Playlist ready", style = MaterialTheme.typography.titleLarge)
                    Text(
                        "${s.added} tracks added",
                        style = MaterialTheme.typography.bodySmall,
                        color = LocalMeloColors.current.textSecondary,
                    )
                    Spacer(Modifier.height(Spacing.sm))
                    MeloTextButton("Open playlist") { onOpenPlaylist(s.playlistId) }
                }
                is ImportStage.Ready -> {
                    val matched = s.matches.count { it.isMatched }
                    val unmatched = s.matches.size - matched
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        MeloArt(s.preview.artwork, Modifier.size(52.dp), corner = 12.dp)
                        Spacer(Modifier.width(Spacing.md))
                        Column(Modifier.weight(1f)) {
                            Text(s.preview.name, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(
                                "$matched matched · $unmatched not found",
                                style = MaterialTheme.typography.bodySmall,
                                color = LocalMeloColors.current.textSecondary,
                            )
                        }
                        MeloTextButton("Create") { vm.createPlaylist(s.preview.name.ifBlank { "Imported playlist" }) }
                    }
                    if (unmatched > 0) {
                        Text(
                            "Unmatched tracks are listed but skipped. Repeat the import later to retry them.",
                            style = MaterialTheme.typography.labelSmall,
                            color = LocalMeloColors.current.textSecondary,
                            modifier = Modifier.padding(horizontal = Spacing.screenH, vertical = 6.dp),
                        )
                    }
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(s.matches, key = { it.imported.title + it.imported.artist }) { match ->
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = Spacing.screenH, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Box(
                                    Modifier
                                        .size(8.dp)
                                        .clip(RoundedCornerShape(50))
                                        .background(
                                            when {
                                                !match.isMatched -> MaterialTheme.colorScheme.error
                                                match.ambiguous -> MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
                                                else -> MaterialTheme.colorScheme.primary
                                            },
                                        ),
                                )
                                Spacer(Modifier.width(Spacing.md))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        match.imported.title,
                                        style = MaterialTheme.typography.titleMedium,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    Text(
                                        match.imported.artist,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = LocalMeloColors.current.textSecondary,
                                        maxLines = 1,
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        if (match.isMatched) "matched" else "not found",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (match.isMatched) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.error,
                                    )
                                    if (match.ambiguous) {
                                        Text(
                                            "check",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = LocalMeloColors.current.textSecondary,
                                        )
                                    }
                                }
                            }
                        }
                        item {
                            Spacer(Modifier.height(60.dp))
                            Text(
                                "Import uses Spotify's public playlist page. Private playlists and the full Web API " +
                                    "need a Spotify developer app and OAuth login, which is not configured in this build.",
                                style = MaterialTheme.typography.labelSmall,
                                color = LocalMeloColors.current.textSecondary,
                                modifier = Modifier.padding(horizontal = Spacing.screenH),
                            )
                            Spacer(Modifier.height(40.dp))
                        }
                    }
                }
            }
        }
    }
}
