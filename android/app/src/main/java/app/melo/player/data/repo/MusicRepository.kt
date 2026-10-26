package app.melo.player.data.repo

import app.melo.player.data.db.DownloadDao
import app.melo.player.data.db.toTrack
import app.melo.player.data.model.Album
import app.melo.player.data.model.AlbumPage
import app.melo.player.data.model.Artist
import app.melo.player.data.model.ArtistPage
import app.melo.player.data.model.HomeSection
import app.melo.player.data.model.SearchResults
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import app.melo.player.data.prefs.SettingsRepository
import app.melo.player.data.remote.Catalog
import app.melo.player.data.remote.SoundCloud
import app.melo.player.data.remote.TextRules
import app.melo.player.data.remote.YouTubeMusic
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * The single place screens ask for music.
 *
 * Everything returned here comes from a live provider or from the user's own
 * library — no invented charts, counts or listening history.
 */
class MusicRepository(
    private val library: LibraryRepository,
    private val downloads: DownloadDao,
    private val settings: SettingsRepository,
) {

    /* ------------------------------ search ------------------------------ */

    suspend fun search(query: String, includeSoundcloud: Boolean = true): SearchResults {
        val trimmed = query.trim()
        if (trimmed.isBlank()) return SearchResults()

        val explicitAllowed = settings.current().showExplicit

        return coroutineScope {
            val tracks = async { YouTubeMusic.searchSongs(trimmed, 24) }
            val artists = async { YouTubeMusic.searchArtists(trimmed, 16) }
            val albums = async { YouTubeMusic.searchAlbums(trimmed, 20) }
            val playlists = async { YouTubeMusic.searchPlaylists(trimmed, 16) }
            val sc = async {
                if (includeSoundcloud) SoundCloud.search(trimmed, 12) else emptyList()
            }

            val ytTracks = tracks.await()
            val scTracks = sc.await()
            SearchResults(
                tracks = (ytTracks + scTracks)
                    .filter { explicitAllowed || !it.explicit }
                    .let(::dedupe),
                artists = artists.await().distinctBy { it.name.lowercase() },
                albums = albums.await().distinctBy { it.title.lowercase() + it.artist.lowercase() },
                playlists = playlists.await().distinctBy { it.id },
            )
        }
    }

    suspend fun suggestions(query: String): List<String> {
        if (query.isBlank()) return emptyList()
        val remote = runCatching { YouTubeMusic.suggestions(query) }.getOrDefault(emptyList())
        if (remote.isNotEmpty()) return remote
        // Fall back to what the user actually searched for before.
        val recent = library.recentSearches.first()
        return recent.filter { it.contains(query, true) }.take(6)
    }

    suspend fun trending(): List<Track> = Catalog.topSongs(24)

    suspend fun newReleases(): List<Album> = Catalog.newReleases(limit = 20)

    /* ------------------------------- home -------------------------------- */

    /**
     * Provider-backed home sections. Local sections (history, playlists, downloads)
     * are combined by the screen from Room flows so they update instantly.
     */
    suspend fun providerSections(): List<HomeSection> = coroutineScope {
        val explicitAllowed = settings.current().showExplicit
        val followed = library.followedArtists.first()
        val history = library.history.first()
        val top = library.mostPlayed.first().map { it.first }

        val trendingAsync = async { runCatching { Catalog.topSongs(24) }.getOrDefault(emptyList()) }
        val releasesAsync = async { runCatching { Catalog.newReleases(limit = 20) }.getOrDefault(emptyList()) }
        val recsAsync = async { runCatching { forYou(history, top, followed) }.getOrDefault(emptyList()) }

        val sections = mutableListOf<HomeSection>()

        val recs = recsAsync.await()
        sections += recs

        val trending = trendingAsync.await().filter { explicitAllowed || !it.explicit }
        if (trending.isNotEmpty()) {
            sections += HomeSection(
                id = "trending",
                title = "Trending now",
                subtitle = "iTunes top songs, updated continuously",
                tracks = trending,
            )
        }

        val releases = releasesAsync.await()
        if (releases.isNotEmpty()) {
            sections += HomeSection(
                id = "new-releases",
                title = "New releases",
                subtitle = "Fresh albums on iTunes",
                albums = releases,
                kind = HomeSection.Kind.ALBUMS,
            )
        }

        if (followed.isNotEmpty()) {
            sections += HomeSection(
                id = "your-artists",
                title = "Artists you follow",
                artists = followed,
                kind = HomeSection.Kind.ARTISTS,
            )
        }

        sections.filterNot { it.isEmpty }
    }

    /**
     * Real recommendations: take what the user actually plays, ask Deezer for related
     * artists, then pull those artists' songs from the catalog. Each row is labelled
     * with the seed that produced it, so nothing looks like an invented chart.
     */
    private suspend fun forYou(
        history: List<Track>,
        mostPlayed: List<Track>,
        followed: List<Artist>,
    ): List<HomeSection> = coroutineScope {
        val seedArtists = (
            mostPlayed.take(2).map { it.artist } +
                history.take(3).map { it.artist } +
                followed.take(2).map { it.name }
            )
            .filter { it.isNotBlank() }
            .distinctBy { it.lowercase() }
            .take(2)

        if (seedArtists.isEmpty()) return@coroutineScope emptyList()

        val known = (history + mostPlayed).map { TextRules.normalizeKey(it.title, it.artist) }.toSet()

        seedArtists.map { seed ->
            async {
                val related = runCatching { Catalog.relatedArtistsByName(seed, 4) }
                    .getOrDefault(emptyList())
                if (related.isEmpty()) return@async null

                val tracks = mutableListOf<Track>()
                for (artist in related.take(3)) {
                    val hits = runCatching { YouTubeMusic.searchSongs(artist.name, 6) }
                        .getOrDefault(emptyList())
                        .filter { TextRules.normalizeKey(it.title, it.artist) !in known }
                        .filter { TextRules.similarity(it.artist, artist.name) > 0.45 }
                        .take(3)
                    tracks += hits
                }
                val unique = tracks.distinctBy { TextRules.normalizeKey(it.title, it.artist) }.take(10)
                if (unique.isEmpty()) null
                else HomeSection(
                    id = "for-you-$seed",
                    title = "Because you listen to $seed",
                    subtitle = "Related artists from Deezer, songs from the catalog",
                    tracks = unique,
                )
            }
        }.awaitAll().filterNotNull()
    }

    /* ------------------------------ library ------------------------------ */

    fun downloadedTracks(): kotlinx.coroutines.flow.Flow<List<Track>> =
        downloads.completed().map { list -> list.map { it.track.toTrack() } }

    /* --------------------------- artist / album -------------------------- */

    suspend fun artistPage(name: String): ArtistPage = Catalog.artistPage(name)

    suspend fun albumPage(album: Album): AlbumPage = Catalog.albumPage(album)

    suspend fun providerPlaylist(browseId: String): List<Track> = YouTubeMusic.browseTracks(browseId)

    suspend fun artistsForQuery(query: String): List<Artist> = YouTubeMusic.searchArtists(query, 12)

    /* ------------------------------ helpers ------------------------------ */

    private fun dedupe(tracks: List<Track>): List<Track> {
        val seen = HashSet<String>(tracks.size)
        val out = ArrayList<Track>(tracks.size)
        for (t in tracks) {
            val key = TextRules.normalizeKey(t.title, t.artist)
            if (seen.add(key)) out += t
        }
        return out
    }

    companion object {
        /** YouTube Music album browse ids look like MPREb_…, playlists like VLPL… */
        fun isProviderPlaylist(id: String): Boolean =
            id.startsWith("VL") || id.startsWith("PL") || id.startsWith("RD")

        fun localSourceLabel(source: Source): String = source.label
    }
}
