package app.melo.player.data.remote

import app.melo.player.data.model.Album
import app.melo.player.data.model.AlbumPage
import app.melo.player.data.model.Artist
import app.melo.player.data.model.ArtistPage
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Artist / album / chart metadata.
 *
 * The desktop app mixed iTunes for artwork and discographies with Deezer for
 * related artists and charts; melo keeps exactly that combination because both are
 * free, keyless and stable.
 */
object Catalog {

    private const val ITUNES = "https://itunes.apple.com"
    private const val DEEZER = "https://api.deezer.com"

    private val artistCache = HashMap<String, ArtistPage>()

    /* ------------------------------ charts ------------------------------ */

    suspend fun topSongs(limit: Int = 24): List<Track> {
        val json = Api.getJson("$ITUNES/us/rss/topsongs/limit=$limit/json") ?: return emptyList()
        val entries = json.at("feed", "entry").let {
            when (it) {
                is kotlinx.serialization.json.JsonArray -> it.toList()
                null -> emptyList()
                else -> listOf(it)
            }
        }
        return entries.mapNotNull { e ->
            val title = e.at("im:name", "label").asText() ?: return@mapNotNull null
            val artist = e.at("im:artist", "label").asText().orEmpty()
            val rawImg = e.at("im:image").let { imgs ->
                when (imgs) {
                    is kotlinx.serialization.json.JsonArray ->
                        (imgs.lastOrNull() as? JsonObject)?.str("label").orEmpty()
                    is JsonObject -> imgs.str("label").orEmpty()
                    else -> ""
                }
            }
            val art = upscaleArtwork(rawImg)
            val appleId = e.at("id", "attributes", "im:id").asText() ?: title
            Track(
                id = "",
                title = title,
                artist = artist.ifBlank { "Unknown artist" },
                artwork = art,
                source = Source.YOUTUBE,
                searchQuery = "$artist $title".trim(),
                webUrl = "itunes:$appleId",
            )
        }.filter { it.title.isNotBlank() }
    }

    suspend fun newReleases(country: String = "us", limit: Int = 20): List<Album> {
        val json = Api.getJson("$ITUNES/$country/rss/newreleases/limit=$limit/json") ?: return emptyList()
        val entries = json.at("feed", "entry").let {
            when (it) {
                is kotlinx.serialization.json.JsonArray -> it.toList()
                null -> emptyList()
                else -> listOf(it)
            }
        }
        return entries.mapNotNull { e ->
            val title = e.at("im:name", "label").asText() ?: return@mapNotNull null
            val artist = e.at("im:artist", "label").asText().orEmpty()
            val art = upscaleArtwork(e.at("im:image").lastImageLabel())
            Album(
                id = "itunes:" + (e.at("id", "attributes", "im:id").asText() ?: title),
                title = title,
                artist = artist,
                artwork = art,
            )
        }
    }

    private fun JsonElement?.lastImageLabel(): String = when (this) {
        is kotlinx.serialization.json.JsonArray -> (lastOrNull() as? JsonObject)?.str("label").orEmpty()
        is JsonObject -> str("label").orEmpty()
        else -> ""
    }

    /* ------------------------------ artists ------------------------------ */

    suspend fun artistPage(name: String): ArtistPage {
        val clean = TextRules.normalizeArtist(name).ifBlank { name.trim() }
        artistCache[clean.lowercase()]?.let { return it }

        // Deezer first: one call gives portrait, fan count, biography and related artists.
        val dz = Api.getJson("$DEEZER/search/artist?q=${enc(clean)}&limit=5")
            ?.arr("data").asObjects()
            ?.firstOrNull { it.str("name")?.equals(name.trim(), true) == true }
            ?: Api.getJson("$DEEZER/search/artist?q=${enc(clean)}&limit=1")
                ?.arr("data").asObjects()?.firstOrNull()

        val dzId = dz?.num("id")
        var artwork = dz?.str("picture_xl").orEmpty()
        var banner = dz?.str("picture_xl").orEmpty()
        var fans = dz?.num("nb_fan") ?: 0L
        var bio = ""

        if (dzId != null) {
            Api.getJson("$DEEZER/artist/$dzId")
                ?.let { detail ->
                    artwork = detail.str("picture_xl").orEmpty().ifBlank { artwork }
                    banner = detail.str("picture_xl").orEmpty().ifBlank { banner }
                    fans = detail.num("nb_fan") ?: fans
                }
            // Deezer has no biography endpoint; Wikipedia is the same source the
            // desktop app used for artist descriptions.
            bio = wikipediaSummary(name)
        }

        val itunesArtist = Api.getJson(
            "$ITUNES/search?term=${enc(clean)}&entity=musicArtist&limit=5",
        )?.arr("results").asObjects()
            ?.firstOrNull { it.str("artistName")?.equals(name.trim(), true) == true }

        if (artwork.isBlank()) {
            val itId = itunesArtist?.num("artistId")
            if (itId != null) {
                artwork = Api.getJson("$ITUNES/lookup?id=$itId&entity=musicArtist")?.arr("results")
                    .asObjects()?.firstOrNull()?.str("artworkUrl100")?.let { upscaleArtwork(it) }.orEmpty()
            }
        }

        val albums = runCatching { artistAlbums(clean) }.getOrElse { emptyList() }
        val topTracks = runCatching { YouTubeMusic.searchSongs(clean, 20) }.getOrElse { emptyList() }
            .filter { matchesArtist(it.artist, clean) }
            .ifEmpty { runCatching { YouTubeMusic.searchSongs(clean, 20) }.getOrElse { emptyList() } }
        val related = runCatching { relatedArtists(dzId) }.getOrElse { emptyList() }

        // Monthly listeners are an artist-level metric and only exist on YouTube Music.
        val monthly = runCatching { YouTubeMusic.monthlyListeners(clean) }.getOrNull() ?: 0L

        val page = ArtistPage(
            artist = Artist(
                id = dzId?.toString() ?: name,
                name = name.trim(),
                artwork = artwork,
                banner = banner.ifBlank { artwork },
                monthlyListeners = monthly,
                bio = bio,
                verified = itunesArtist != null,
            ),
            topTracks = topTracks,
            albums = albums.filter { !it.title.contains("single", true) }.take(20),
            singles = albums.filter { it.title.contains("single", true) }.take(12),
            related = related,
        )
        artistCache[clean.lowercase()] = page
        return page
    }

    private fun matchesArtist(candidate: String?, target: String): Boolean {
        val c = TextRules.normalizeArtist(candidate).lowercase()
        val t = TextRules.normalizeArtist(target).lowercase()
        if (c.isBlank() || t.isBlank()) return false
        return c == t || c.contains(t) || t.contains(c)
    }

    suspend fun artistAlbums(name: String): List<Album> {
        val body = Api.getJson(
            "$ITUNES/search?term=${enc(name)}&entity=album&attribute=artistTerm&limit=35",
        ) ?: return emptyList()
        return body.arr("results").asObjects()
            .filter { it.str("wrapperType") == "collection" }
            .filter { it.str("artistName")?.equals(name, true) == true }
            .map { a ->
                Album(
                    id = "itunes:" + (a.num("collectionId")?.toString() ?: a.str("collectionName").orEmpty()),
                    title = a.str("collectionName").orEmpty(),
                    artist = a.str("artistName").orEmpty(),
                    artwork = upscaleArtwork(a.str("artworkUrl100").orEmpty()),
                    year = a.str("releaseDate")?.take(4).orEmpty(),
                    trackCount = (a.num("trackCount") ?: 0L).toInt(),
                )
            }
            .filter { it.title.isNotBlank() }
    }

    private suspend fun relatedArtists(deezerId: Long?): List<Artist> {
        if (deezerId == null) return emptyList()
        return Api.getJson("$DEEZER/artist/$deezerId/related")
            ?.arr("data").asObjects()
            ?.map {
                Artist(
                    id = it.num("id")?.toString().orEmpty(),
                    name = it.str("name").orEmpty(),
                    artwork = it.str("picture_xl").orEmpty(),
                )
            }
            ?.filter { it.name.isNotBlank() }
            ?.take(12)
            .orEmpty()
    }

    /** Related artists by name, used by the recommendation engine. */
    suspend fun relatedArtistsByName(name: String, limit: Int = 6): List<Artist> {
        val clean = TextRules.normalizeArtist(name).ifBlank { name.trim() }
        if (clean.isBlank()) return emptyList()
        val search = Api.getJson("$DEEZER/search/artist?q=${enc(clean)}&limit=3")
            ?.arr("data").asObjects().orEmpty()
        val dzId = search.firstOrNull { it.str("name")?.equals(name.trim(), true) == true }?.num("id")
            ?: search.firstOrNull()?.num("id")
            ?: return emptyList()
        return relatedArtists(dzId)
            .filter { !it.name.equals(name.trim(), true) }
            .take(limit)
    }

    private suspend fun wikipediaSummary(name: String): String {
        val search = Api.getJson(
            "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
                "${enc(name + " band")}&format=json&srlimit=1",
        )
        val title = search.at("query", "search").asObjects().firstOrNull()?.str("title") ?: return ""
        val summary = Api.getJson("https://en.wikipedia.org/api/rest_v1/page/summary/${enc(title)}")
        return summary.str("extract").orEmpty()
    }

    /* ------------------------------- albums ------------------------------- */

    /**
     * Album tracks. YouTube Music albums resolve to directly playable tracks; Deezer
     * and iTunes albums produce metadata-only tracks that resolve on demand.
     */
    suspend fun albumPage(album: Album): AlbumPage {
        if (album.id.startsWith("MPREb_") || album.id.startsWith("VL")) {
            val tracks = YouTubeMusic.browseTracks(album.id)
            if (tracks.isNotEmpty()) return AlbumPage(album.copy(trackCount = tracks.size), tracks)
        }
        val appleId = album.id.removePrefix("itunes:")
        if (appleId.toLongOrNull() != null) {
            val body = Api.getJson("$ITUNES/lookup?id=$appleId&entity=song&limit=100")
            val results = body?.arr("results").asObjects().orEmpty()
            val collection = results.firstOrNull { it.str("wrapperType") == "collection" }
            val songs = results.filter { it.str("wrapperType") == "track" }
                .sortedBy { it.num("trackNumber") ?: 0L }
            if (songs.isNotEmpty()) {
                val resolved = Album(
                    id = album.id,
                    title = collection?.str("collectionName") ?: album.title,
                    artist = collection?.str("artistName") ?: album.artist,
                    artwork = upscaleArtwork(collection?.str("artworkUrl100").orEmpty())
                        .ifBlank { album.artwork },
                    year = (collection?.str("releaseDate") ?: album.year).take(4),
                    trackCount = songs.size,
                )
                return AlbumPage(resolved, songs.map { s ->
                    val name = s.str("trackName").orEmpty()
                    val artist = s.str("artistName").orEmpty()
                    Track(
                        id = "",
                        title = name,
                        artist = artist,
                        album = resolved.title,
                        durationMs = (s.num("trackTimeMillis") ?: 0L),
                        artwork = resolved.artwork,
                        source = Source.YOUTUBE,
                        explicit = s.str("trackExplicitness") == "explicit",
                        searchQuery = "$artist $name".trim(),
                    )
                })
            }
        }
        return AlbumPage(album, emptyList())
    }

    /* ------------------------------ helpers ------------------------------ */

    fun upscaleArtwork(url: String): String = url
        .replace(Regex("/\\d+x\\d+bb\\."), "/600x600bb.")
        .ifBlank { "" }

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    private fun JsonElement?.asText(): String? = (this as? JsonPrimitive)?.content
}
