package app.melo.player.data.remote

import app.melo.player.data.model.ResolvedStream
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track

/**
 * SoundCloud public API. Port of `refreshServerScClientId`, `searchSoundcloud` and
 * `fetchDirectSoundCloudStreamServer` from the desktop server: the public `client_id`
 * is read from the site's own JavaScript bundle and refreshed when it goes stale.
 */
object SoundCloud {

    @Volatile private var clientId: String = "tHVbSbDP4TaoMbPppngv6Tdry83vNbMQ"
    @Volatile private var refreshedAt: Long = 0L

    private const val API = "https://api-v2.soundcloud.com"
    private const val ASSET_HOST = "https://a-v2.sndcdn.com"

    private suspend fun ensureClientId(force: Boolean = false): String {
        val fresh = System.currentTimeMillis() - refreshedAt < 30 * 60 * 1000L
        if (clientId.isNotBlank() && fresh && !force) return clientId
        val page = Api.get("https://soundcloud.com") ?: return clientId
        val assets = Regex("""src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"""")
            .findAll(page).map { it.groupValues[1] }.toList()
        for (asset in assets.takeLast(4)) {
            val code = Api.get(asset) ?: continue
            val hit = Regex("""client_id[:=]\s*["']([a-zA-Z0-9]{32})["']""").find(code)
            if (hit != null) {
                clientId = hit.groupValues[1]
                refreshedAt = System.currentTimeMillis()
                return clientId
            }
        }
        return clientId
    }

    private suspend fun apiGet(path: String): kotlinx.serialization.json.JsonElement? {
        var cid = ensureClientId()
        var json = Api.getJson("$API$path${if (path.contains("?")) "&" else "?"}client_id=$cid")
        if (json == null) {
            cid = ensureClientId(force = true)
            json = Api.getJson("$API$path${if (path.contains("?")) "&" else "?"}client_id=$cid")
        }
        return json
    }

    suspend fun search(query: String, limit: Int = 20): List<Track> {
        if (query.isBlank()) return emptyList()
        val json = apiGet("/search/tracks?q=${enc(query)}&limit=$limit&linked_partitioning=0") ?: return emptyList()
        return json.arr("collection").asObjects().mapNotNull { toTrack(it) }
    }

    private fun toTrack(o: kotlinx.serialization.json.JsonObject): Track? {
        val id = o.str("id") ?: o.num("id")?.toString() ?: return null
        val title = o.str("title") ?: return null
        if (o.str("policy") == "SNIP") return null
        val user = o.obj("user")
        val artwork = o.str("artwork_url")?.replace("large", "t500x500")
            ?: user?.str("avatar_url")?.replace("large", "t500x500")
            ?: ""
        return Track(
            id = id,
            title = title,
            artist = user?.str("username").orEmpty().ifBlank { "SoundCloud" },
            durationMs = (o.num("duration") ?: 0L),
            artwork = artwork,
            source = Source.SOUNDCLOUD,
            explicit = o.bool("explicit") || TextRules.looksExplicit(title),
            streamUrl = o.str("stream_url").orEmpty(),
            webUrl = o.str("permalink_url").orEmpty(),
        )
    }

    /** Resolve a progressive transcoding, as the desktop server did. */
    suspend fun resolveAudio(trackId: String, fallbackQuery: String = ""): ResolvedStream {
        var cid = ensureClientId()
        repeat(2) { attempt ->
            val track = apiGet("/tracks/$trackId") ?: return@repeat
            val transcodings = track.arr("transcodings").asObjects()
            val progressive = transcodings.firstOrNull {
                it.at("format", "protocol").asText() == "progressive"
            }
            val hls = transcodings.firstOrNull {
                it.at("format", "protocol").asText() == "hls" &&
                    !it.at("format", "mime_type").asText().orEmpty().contains("encrypted", true)
            }
            val chosen = progressive ?: hls ?: return@repeat
            val base = chosen.str("url") ?: return@repeat
            val auth = track.str("track_authorization")?.let { "&track_authorization=$it" }.orEmpty()
            val sep = if (base.contains("?")) "&" else "?"
            val resolved = Api.getJson("$base${sep}client_id=$cid$auth", userAgent = Api.WEB_UA)
            val url = resolved.str("url")
            if (url != null) {
                return ResolvedStream.Remote(url, hls = chosen.at("format", "protocol").asText() == "hls")
            }
            cid = ensureClientId(force = true)
        }
        return ResolvedStream.Failure("SoundCloud could not provide this track.")
    }

    /**
     * SoundCloud search-and-play, used when a catalog entry has no direct id
     * (for example a Spotify import that only matched metadata).
     */
    suspend fun resolveByQuery(query: String): Track? {
        val hits = search(query, limit = 6)
        return hits.firstOrNull { it.durationMs > 30_000 } ?: hits.firstOrNull()
    }

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    private fun kotlinx.serialization.json.JsonElement?.asText(): String? =
        (this as? kotlinx.serialization.json.JsonPrimitive)?.content
}
