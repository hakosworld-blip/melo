package app.melo.player.data.remote

import app.melo.player.data.model.Track
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Spotify playlist import.
 *
 * Public playlists are read from the public embed page Spotify serves to any browser
 * (the same source the desktop app used), which needs no credentials and no user
 * login. Track metadata is then matched against the melo catalog by title, artist and
 * duration, and the user reviews the matches before anything is created.
 *
 * Private playlists and the full Web API require a Spotify developer app and an OAuth
 * login; that path is not enabled here because shipping a client secret in an APK is
 * not acceptable. See the README for what that would take.
 *
 * Nothing in this file obtains, decrypts or downloads Spotify audio.
 */
object SpotifyImport {

    data class ImportedTrack(
        val title: String,
        val artist: String,
        val album: String = "",
        val durationMs: Long = 0L,
    )

    data class Preview(
        val name: String,
        val owner: String,
        val artwork: String,
        val tracks: List<ImportedTrack>,
        val source: String,
    )

    data class Match(
        val imported: ImportedTrack,
        val matched: Track?,
        val score: Double,
        val ambiguous: Boolean,
    ) {
        val isMatched: Boolean get() = matched != null
    }

    /** Accepts web URLs, `spotify:playlist:` URIs, and bare ids. */
    fun playlistId(input: String): String? {
        val value = input.trim()
        if (value.isEmpty()) return null
        if (Regex("^[A-Za-z0-9]{22}$").matches(value)) return value
        Regex("spotify:playlist:([A-Za-z0-9]+)").find(value)?.let { return it.groupValues[1] }
        Regex("open\\.spotify\\.com/(?:intl-[a-z-]+/)?playlist/([A-Za-z0-9]+)")
            .find(value)?.let { return it.groupValues[1] }
        if (value.contains("spotify", ignoreCase = true)) {
            Regex("playlist/([A-Za-z0-9]{10,})").find(value)?.let { return it.groupValues[1] }
        }
        return null
    }

    suspend fun fetchPlaylist(id: String): Result<Preview> {
        val html = Api.get(
            "https://open.spotify.com/embed/playlist/$id",
            headers = mapOf(
                "Accept-Language" to "en-US,en;q=0.9",
                "Referer" to "https://open.spotify.com/",
            ),
        ) ?: return Result.failure(IllegalStateException("Spotify did not respond. Check the link and your connection."))

        val payload = extractNextData(html)
            ?: return Result.failure(IllegalStateException("This playlist page had no readable data."))

        val name = payload.firstStringOrNull(listOf("name", "title"))
            ?: "Spotify playlist"
        val artwork = payload.firstStringOrNull(listOf("coverArt", "image", "cover"))
            ?: ""

        var tracks = findTrackList(payload)
        if (tracks.isEmpty()) {
            // Older embeds expose a flatter structure.
            tracks = findTrackListByShape(payload)
        }
        if (tracks.isEmpty()) {
            return Result.failure(
                IllegalStateException(
                    "No tracks could be read. The playlist may be private, region-locked, or Spotify changed its page format.",
                ),
            )
        }

        val owner = payload.firstStringOrNull(listOf("subtitle", "ownerName", "owner")) ?: ""
        return Result.success(
            Preview(
                name = name,
                owner = owner,
                artwork = artwork,
                tracks = tracks,
                source = "Spotify embed",
            ),
        )
    }

    private fun extractNextData(html: String): JsonObject? {
        val next = Regex(
            """<script id="__NEXT_DATA__" type="application/json">(.*?)</script>""",
            setOf(RegexOption.DOT_MATCHES_ALL),
        ).find(html)?.groupValues?.get(1)
        if (next != null) {
            (Api.parse(next) as? JsonObject)?.let { return it }
        }
        // Fallback: some responses embed a raw JSON blob in a different script tag.
        val alt = Regex(
            """<script[^>]*type="application/json"[^>]*>(.*?)</script>""",
            setOf(RegexOption.DOT_MATCHES_ALL),
        ).findAll(html).map { it.groupValues[1] }.firstOrNull { it.contains("trackList") }
        return alt?.let { Api.parse(it) as? JsonObject }
    }

    private fun findTrackList(root: JsonObject): List<ImportedTrack> {
        val found = mutableListOf<ImportedTrack>()
        fun walk(el: Any?) {
            when (el) {
                is JsonObject -> {
                    val list = el["trackList"] as? JsonArray
                    if (list != null && list.isNotEmpty()) {
                        val parsed = list.mapNotNull { toImported(it) }
                        if (parsed.size > found.size) {
                            found.clear()
                            found += parsed
                        }
                    }
                    el.values.forEach { walk(it) }
                }
                is JsonArray -> el.forEach { walk(it) }
                else -> Unit
            }
        }
        walk(root)
        return found
    }

    private fun toImported(el: Any?): ImportedTrack? {
        val o = el as? JsonObject ?: return null
        val title = (o["title"] as? JsonPrimitive)?.content
            ?: (o["name"] as? JsonPrimitive)?.content
        if (title.isNullOrBlank()) return null
        val artist = (o["subtitle"] as? JsonPrimitive)?.content
            ?: (o["artists"] as? JsonArray)?.joinToString(", ") {
                (it as? JsonPrimitive)?.content.orEmpty()
            }.orEmpty()
        val duration = (o["duration"] as? JsonPrimitive)?.content?.toLongOrNull() ?: 0L
        return ImportedTrack(
            title = title,
            artist = artist.ifBlank { "Unknown artist" },
            durationMs = duration,
        )
    }

    /** Last resort for structures that list tracks as objects with name/artist fields. */
    private fun findTrackListByShape(root: JsonObject): List<ImportedTrack> {
        val out = mutableListOf<ImportedTrack>()
        fun walk(el: Any?) {
            when (el) {
                is JsonArray -> {
                    val parsed = el.mapNotNull { item ->
                        val o = item as? JsonObject ?: return@mapNotNull null
                        val hasTitle = o.containsKey("name") || o.containsKey("title")
                        val hasArtist = o.containsKey("artists") || o.containsKey("artist") || o.containsKey("subtitle")
                        if (hasTitle && hasArtist) toImported(o) else null
                    }
                    if (parsed.size > out.size) {
                        out.clear()
                        out += parsed
                    }
                    el.forEach { walk(it) }
                }
                is JsonObject -> el.values.forEach { walk(it) }
                else -> Unit
            }
        }
        walk(root)
        return out
    }

    private fun JsonObject.firstStringOrNull(keys: List<String>): String? {
        for (key in keys) {
            val value = this[key] as? JsonPrimitive ?: continue
            if (value.content.isNotBlank()) return value.content
        }
        return null
    }

    /**
     * Match imported metadata against the catalog. Four lookups run at a time to keep
     * the provider happy while still finishing a 100-track playlist in a few seconds.
     */
    suspend fun match(
        tracks: List<ImportedTrack>,
        onProgress: (done: Int, total: Int) -> Unit = { _, _ -> },
    ): List<Match> {
        val semaphore = Semaphore(4)
        val results = arrayOfNulls<Match>(tracks.size)
        val done = java.util.concurrent.atomic.AtomicInteger(0)

        kotlinx.coroutines.coroutineScope {
            tracks.forEachIndexed { index, imported ->
                launch {
                    semaphore.withPermit {
                        results[index] = matchOne(imported)
                        onProgress(done.incrementAndGet(), tracks.size)
                    }
                }
            }
        }
        return results.mapIndexed { i, m -> m ?: Match(tracks[i], null, 0.0, false) }
    }

    private suspend fun matchOne(imported: ImportedTrack): Match {
        val query = listOf(imported.artist, imported.title).filter { it.isNotBlank() }.joinToString(" ")
        val hits = runCatching { YouTubeMusic.searchSongs(query, 6) }.getOrDefault(emptyList())
        if (hits.isEmpty()) return Match(imported, null, 0.0, false)

        val scored = hits.map { it to score(imported, it) }.sortedByDescending { it.second }
        val best = scored.first()
        val second = scored.getOrNull(1)?.second ?: 0.0

        return if (best.second >= 0.55) {
            Match(
                imported = imported,
                matched = best.first,
                score = best.second,
                ambiguous = best.second < 0.72 || (best.second - second) < 0.06,
            )
        } else {
            Match(imported, null, best.second, false)
        }
    }

    private fun score(imported: ImportedTrack, candidate: Track): Double {
        val title = TextRules.similarity(imported.title, candidate.title)
        val artist = TextRules.similarity(imported.artist, candidate.artist)
        val duration = if (imported.durationMs > 0 && candidate.durationMs > 0) {
            val delta = kotlin.math.abs(imported.durationMs - candidate.durationMs)
            when {
                delta < 5_000 -> 1.0
                delta < 15_000 -> 0.6
                delta < 40_000 -> 0.2
                else -> 0.0
            }
        } else {
            0.5
        }
        return title * 0.55 + artist * 0.30 + duration * 0.15
    }

}
