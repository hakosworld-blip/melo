package app.melo.player.data.remote

import app.melo.player.data.model.Album
import app.melo.player.data.model.Artist
import app.melo.player.data.model.ResolvedStream
import app.melo.player.data.model.SearchPlaylist
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

/**
 * YouTube Music through Google's public InnerTube endpoints.
 *
 * This is a direct port of the desktop server's `ytmSearchRequest`, `parseYtmSongs`
 * and `fetchDirectYoutubeStreamServer`, so search quality and stream resolution
 * behave the same as on desktop.
 */
object YouTubeMusic {

    private const val CLIENT_VERSION = "1.20250101.01.00"
    private const val SEARCH_URL = "https://music.youtube.com/youtubei/v1/search?prettyPrint=false"
    private const val BROWSE_URL = "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false"
    private const val PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false"

    // OuterTube filter params for the "Songs", "Artists", "Albums", "Playlists" chips.
    private const val PARAM_SONGS = "EgWKAQIIAWoMEA4QChADEAQQCRAF"
    private const val PARAM_ARTISTS = "EgWKAQIgAWoMEA4QChADEAQQCRAF"
    private const val PARAM_ALBUMS = "EgWKAQIYAWoMEA4QChADEAQQCRAF"
    private const val PARAM_PLAYLISTS = "EgWKAQIoAWoMEA4QChADEAQQCRAF"

    private fun webRemixBody(query: String, params: String): String = buildJsonObject {
        putJsonObject("context") {
            putJsonObject("client") {
                put("clientName", "WEB_REMIX")
                put("clientVersion", CLIENT_VERSION)
                put("hl", "en")
                put("gl", "US")
            }
        }
        put("query", query)
        put("params", params)
    }.toString()

    suspend fun searchSongs(query: String, limit: Int = 24): List<Track> {
        if (query.isBlank()) return emptyList()
        val body = webRemixBody(query, PARAM_SONGS)
        val json = Api.postJson(
            SEARCH_URL,
            body,
            headers = mapOf("Origin" to "https://music.youtube.com", "Referer" to "https://music.youtube.com/"),
        ) ?: return emptyList()
        return parseSongItems(json).take(limit)
    }

    suspend fun searchArtists(query: String, limit: Int = 20): List<Artist> {
        if (query.isBlank()) return emptyList()
        val json = Api.postJson(SEARCH_URL, webRemixBody(query, PARAM_ARTISTS)) ?: return emptyList()
        return parseArtistItems(json).take(limit)
    }

    suspend fun searchAlbums(query: String, limit: Int = 20): List<Album> {
        if (query.isBlank()) return emptyList()
        val json = Api.postJson(SEARCH_URL, webRemixBody(query, PARAM_ALBUMS)) ?: return emptyList()
        return parseAlbumItems(json).take(limit)
    }

    suspend fun searchPlaylists(query: String, limit: Int = 20): List<SearchPlaylist> {
        if (query.isBlank()) return emptyList()
        val json = Api.postJson(SEARCH_URL, webRemixBody(query, PARAM_PLAYLISTS)) ?: return emptyList()
        return parsePlaylistItems(json).take(limit)
    }

    /** Live search suggestions, the same endpoint the YouTube Music web app uses. */
    suspend fun suggestions(query: String): List<String> {
        if (query.isBlank()) return emptyList()
        val body = buildJsonObject {
            putJsonObject("context") {
                putJsonObject("client") {
                    put("clientName", "WEB_REMIX")
                    put("clientVersion", CLIENT_VERSION)
                    put("hl", "en")
                    put("gl", "US")
                }
            }
            put("input", query)
        }.toString()
        val json = Api.postJson(
            "https://music.youtube.com/youtubei/v1/music/get_search_suggestions?prettyPrint=false",
            body,
        ) ?: return emptyList()
        return json.collect("searchSuggestionRenderer")
            .map { it.at("suggestion").runsText().trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .take(8)
    }

    private suspend fun browse(browseId: String): JsonElement? {
        if (browseId.isBlank()) return null
        val body = buildJsonObject {
            putJsonObject("context") {
                putJsonObject("client") {
                    put("clientName", "WEB_REMIX")
                    put("clientVersion", CLIENT_VERSION)
                    put("hl", "en")
                    put("gl", "US")
                }
            }
            put("browseId", browseId)
        }.toString()
        return Api.postJson(BROWSE_URL, body)
    }

    /**
     * Artist-level monthly listeners, the one place YouTube Music exposes the metric.
     * Returns 0 when the artist page does not carry it, and the UI then hides it.
     */
    suspend fun monthlyListeners(name: String): Long {
        val artist = searchArtists(name, 6)
            .firstOrNull { it.name.equals(name, true) }
            ?: searchArtists(name, 6).firstOrNull { it.name.contains(name, true) }
            ?: return 0L
        val json = browse(artist.id) ?: return 0L
        return parseListenerCount(allStrings(json))
    }

    private fun allStrings(el: JsonElement?): List<String> {
        val out = mutableListOf<String>()
        fun walk(e: JsonElement?) {
            when (e) {
                null -> Unit
                is kotlinx.serialization.json.JsonPrimitive -> e.content.let { if (it.isNotBlank()) out += it }
                is JsonObject -> e.values.forEach { walk(it) }
                is JsonArray -> e.forEach { walk(it) }
                else -> Unit
            }
        }
        walk(el)
        return out
    }

    private fun parseListenerCount(strings: List<String>): Long {
        for (s in strings) {
            if (!s.contains("monthly listener", true) && !s.contains("слушател", true)) continue
            val m = Regex("([\\d.,]+)\\s*([KMBКМ]|тыс|млн|млрд)?").find(s) ?: continue
            val base = m.groupValues[1].replace(",", "").replace(" ", "").toDoubleOrNull() ?: continue
            val mult = when (m.groupValues[2].uppercase()) {
                "K", "ТЫС" -> 1_000.0
                "M", "МЛН" -> 1_000_000.0
                "B", "МЛРД" -> 1_000_000_000.0
                else -> 1.0
            }
            return (base * mult).toLong()
        }
        return 0L
    }

    /** Album or playlist contents. [browseId] comes from search results. */
    suspend fun browseTracks(browseId: String): List<Track> {
        if (browseId.isBlank()) return emptyList()
        val body = buildJsonObject {
            putJsonObject("context") {
                putJsonObject("client") {
                    put("clientName", "WEB_REMIX")
                    put("clientVersion", CLIENT_VERSION)
                    put("hl", "en")
                    put("gl", "US")
                }
            }
            put("browseId", browseId)
        }.toString()
        val json = Api.postJson(BROWSE_URL, body) ?: return emptyList()
        return parseSongItems(json)
    }

    private fun parseSongItems(root: JsonElement?): List<Track> {
        val out = mutableListOf<Track>()
        val seen = mutableSetOf<String>()
        for (r in root.collect("musicResponsiveListItemRenderer")) {
            val videoId = r.at("playlistItemData", "videoId").asText()
                ?: r.at(
                    "overlay", "musicItemThumbnailOverlayRenderer", "content",
                    "musicPlayButtonRenderer", "playNavigationEndpoint", "watchEndpoint", "videoId",
                ).asText()
                ?: continue
            if (!Regex("^[\\w-]{11}$").matches(videoId)) continue
            if (!seen.add(videoId)) continue

            val cols = r.arr("flexColumns").asObjects()
            val title = cols.getOrNull(0)
                ?.at("musicResponsiveListItemFlexColumnRenderer", "text")
                .runsText()
                .trim()
            if (title.isBlank()) continue

            val subtitle = cols.getOrNull(1)
                ?.at("musicResponsiveListItemFlexColumnRenderer", "text")
                .runsText()

            var artist = ""
            var album = ""
            var duration = 0L
            if (!subtitle.isNullOrBlank()) {
                val segments = subtitle.split("•").map { it.trim() }.filter { it.isNotEmpty() }
                val kindFiltered = segments.filter { !it.equals("song", true) && !it.equals("video", true) }
                val maybeDuration = kindFiltered.lastOrNull()?.let { parseDuration(it) } ?: 0L
                if (maybeDuration > 0) duration = maybeDuration
                val meta = if (maybeDuration > 0) kindFiltered.dropLast(1) else kindFiltered
                artist = meta.getOrNull(0)?.replace(Regex("\\s*-\\s*Topic$", RegexOption.IGNORE_CASE), "")?.trim().orEmpty()
                album = meta.getOrNull(1)?.trim().orEmpty()
            }

            val thumbs = r.at("thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails")
                .asObjects()
            val art = thumbs.lastOrNull()?.str("url")
                ?.replace(Regex("=w\\d+-h\\d+.*$"), "=w544-h544")
                ?: "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"

            out += Track(
                id = videoId,
                title = title,
                artist = artist.ifBlank { "Unknown artist" },
                album = album,
                durationMs = duration,
                artwork = art,
                source = Source.YOUTUBE,
                explicit = isExplicit(r, title),
                webUrl = "https://music.youtube.com/watch?v=$videoId",
            )
        }
        return out
    }

    private fun parseArtistItems(root: JsonElement?): List<Artist> {
        val out = mutableListOf<Artist>()
        val seen = mutableSetOf<String>()
        for (r in root.collect("musicResponsiveListItemRenderer")) {
            val browseId = browseIdOf(r) ?: continue
            val pageType = pageTypeOf(r)
            if (pageType != null && pageType != "MUSIC_PAGE_TYPE_ARTIST") continue
            val cols = r.arr("flexColumns").asObjects()
            val name = cols.getOrNull(0)
                ?.at("musicResponsiveListItemFlexColumnRenderer", "text")
                .runsText()
                .replace(Regex("\\s*-\\s*Topic$", RegexOption.IGNORE_CASE), "")
                .trim()
            if (name.isBlank() || !seen.add(name.lowercase())) continue
            val art = r.at("thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails")
                .asObjects().lastOrNull()?.str("url").orEmpty()
            out += Artist(id = browseId, name = name, artwork = art)
        }
        return out
    }

    private fun parseAlbumItems(root: JsonElement?): List<Album> {
        val out = mutableListOf<Album>()
        val seen = mutableSetOf<String>()
        for (r in root.collect("musicResponsiveListItemRenderer")) {
            val browseId = browseIdOf(r) ?: continue
            val pageType = pageTypeOf(r)
            if (pageType != null && pageType != "MUSIC_PAGE_TYPE_ALBUM") continue
            val cols = r.arr("flexColumns").asObjects()
            val title = cols.getOrNull(0)
                ?.at("musicResponsiveListItemFlexColumnRenderer", "text")
                .runsText().trim()
            if (title.isBlank() || !seen.add(browseId)) continue
            val subtitle = cols.getOrNull(1)
                ?.at("musicResponsiveListItemFlexColumnRenderer", "text")
                .runsText().orEmpty()
            val segments = subtitle.split("•").map { it.trim() }.filter { it.isNotEmpty() }
            val year = segments.lastOrNull { it.matches(Regex("\\d{4}")) }.orEmpty()
            val artist = segments.firstOrNull { !it.matches(Regex("\\d{4}")) && !it.equals("Album", true) }.orEmpty()
            val art = r.at("thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails")
                .asObjects().lastOrNull()?.str("url").orEmpty()
            out += Album(
                id = browseId,
                title = title,
                artist = artist,
                artwork = art,
                year = year,
            )
        }
        return out
    }

    private fun parsePlaylistItems(root: JsonElement?): List<SearchPlaylist> {
        val out = mutableListOf<SearchPlaylist>()
        val seen = mutableSetOf<String>()
        for (r in root.collect("musicResponsiveListItemRenderer")) {
            val browseId = browseIdOf(r) ?: continue
            val pageType = pageTypeOf(r)
            if (pageType != null && pageType != "MUSIC_PAGE_TYPE_PLAYLIST") continue
            val cols = r.arr("flexColumns").asObjects()
            val title = cols.getOrNull(0)
                ?.at("musicResponsiveListItemFlexColumnRenderer", "text")
                .runsText().trim()
            if (title.isBlank() || !seen.add(browseId)) continue
            val subtitle = cols.getOrNull(1)
                ?.at("musicResponsiveListItemFlexColumnRenderer", "text")
                .runsText().orEmpty()
            val segments = subtitle.split("•").map { it.trim() }.filter { it.isNotEmpty() }
            val owner = segments.firstOrNull().orEmpty()
            val count = segments.lastOrNull()
                ?.replace(Regex("[^\\d]"), "")?.toIntOrNull() ?: 0
            val art = r.at("thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails")
                .asObjects().lastOrNull()?.str("url").orEmpty()
            out += SearchPlaylist(
                id = browseId,
                title = title,
                owner = owner,
                artwork = art,
                trackCount = count,
                source = Source.YOUTUBE,
            )
        }
        return out
    }

    private fun browseIdOf(r: JsonObject): String? =
        r.at("navigationEndpoint", "browseEndpoint", "browseId").asText()
            ?: r.at("overlay", "musicItemThumbnailOverlayRenderer", "content",
                "musicPlayButtonRenderer", "playNavigationEndpoint", "browseEndpoint", "browseId").asText()

    private fun pageTypeOf(r: JsonObject): String? =
        r.at(
            "navigationEndpoint", "browseEndpoint",
            "browseEndpointContextSupportedConfigs",
            "browseEndpointContextMusicConfig", "pageType",
        ).asText()

    private fun isExplicit(r: JsonObject, title: String): Boolean {
        val badges = r.arr("badges") ?: JsonArray(emptyList())
        val badgeHit = badges.objects().any { b ->
            b.at("musicInlineBadgeRenderer", "icon", "iconType").asText() == "MUSIC_EXPLICIT_BADGE"
        }
        return badgeHit || TextRules.looksExplicit(title)
    }

    private fun parseDuration(text: String): Long {
        val t = text.trim()
        if (!Regex("^\\d+(:\\d{1,2}){1,2}$").matches(t)) return 0L
        var total = 0L
        for (part in t.split(":")) total = total * 60 + (part.toLongOrNull() ?: 0L)
        return total * 1000L
    }

    /* ------------------------- stream resolution ------------------------- */

    private data class PlayerClient(
        val name: String,
        val version: String,
        val ua: String,
        val sdk: Int? = null,
        val osName: String = "Android",
        val osVersion: String = "12L",
        val deviceMake: String? = null,
        val deviceModel: String? = null,
    )

    private val players = listOf(
        PlayerClient(
            name = "ANDROID_VR",
            version = "1.60.19",
            ua = Api.ANDROID_VR_UA,
            sdk = 32,
        ),
        PlayerClient(
            name = "IOS",
            version = "19.45.4",
            ua = "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
            osName = "iOS",
            osVersion = "18.1.0.22B83",
            deviceMake = "Apple",
            deviceModel = "iPhone16,2",
        ),
    )

    private val streamCache = object : LinkedHashMap<String, Pair<String, Long>>(8, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Pair<String, Long>>?) = size > 12
    }

    /** Resolve a playable audio URL for [videoId]. Results are cached briefly. */
    suspend fun resolveAudio(videoId: String): ResolvedStream {
        val id = extractVideoId(videoId) ?: return ResolvedStream.Failure("Unknown video id")
        synchronized(streamCache) {
            streamCache[id]?.let { (url, ts) ->
                if (System.currentTimeMillis() - ts < 45 * 60 * 1000L) {
                    return ResolvedStream.Remote(url, hls = url.contains(".m3u8"))
                }
            }
        }

        for (client in players) {
            val body = buildJsonObject {
                put("videoId", id)
                putJsonObject("context") {
                    putJsonObject("client") {
                        put("clientName", client.name)
                        put("clientVersion", client.version)
                        client.sdk?.let { put("androidSdkVersion", it) }
                        client.deviceMake?.let { put("deviceMake", it) }
                        client.deviceModel?.let { put("deviceModel", it) }
                        put("osName", client.osName)
                        put("osVersion", client.osVersion)
                        put("hl", "en")
                        put("gl", "US")
                    }
                }
                put("contentCheckOk", true)
                put("racyCheckOk", true)
            }.toString()

            val json = Api.postJson(PLAYER_URL, body, userAgent = client.ua) ?: continue

            val status = json.at("playabilityStatus", "status").asText()
            if (status != null && status != "OK") continue

            val adaptive = json.at("streamingData", "adaptiveFormats").asObjects()
            val progressive = json.at("streamingData", "formats").asObjects()
            val audio = (adaptive + progressive)
                .filter { f ->
                    val mime = f.str("mimeType").orEmpty()
                    val url = f.str("url")
                    mime.startsWith("audio/") && !url.isNullOrBlank() && !mime.contains("encrypted", true)
                }
                .sortedByDescending { it.num("bitrate") ?: 0L }

            audio.firstOrNull()?.str("url")?.let { url ->
                val fixed = if (url.contains("range=")) url else "$url&range=0-"
                synchronized(streamCache) { streamCache[id] = fixed to System.currentTimeMillis() }
                return ResolvedStream.Remote(fixed)
            }

            json.at("streamingData", "hlsManifestUrl").asText()?.let { hls ->
                synchronized(streamCache) { streamCache[id] = hls to System.currentTimeMillis() }
                return ResolvedStream.Remote(hls, hls = true)
            }
        }
        return ResolvedStream.Failure("This track is not available to stream right now.")
    }

    fun extractVideoId(input: String): String? {
        val s = input.trim()
        if (Regex("^[\\w-]{11}$").matches(s)) return s
        return Regex("(?:v=|youtu\\.be/|/embed/|/v/)([\\w-]{11})").find(s)?.groupValues?.get(1)
    }

    private fun kotlinx.serialization.json.JsonElement?.asText(): String? =
        (this as? kotlinx.serialization.json.JsonPrimitive)?.content
}

