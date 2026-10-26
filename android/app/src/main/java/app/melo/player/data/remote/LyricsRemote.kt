package app.melo.player.data.remote

import app.melo.player.data.lyrics.LyricDocument
import app.melo.player.data.lyrics.LyricsParser
import app.melo.player.data.lyrics.LyricsSource
import app.melo.player.data.model.Track

/**
 * Lyrics lookup, in the same order of preference as the desktop app:
 * local custom lyrics -> LRCLIB (synced if available) -> NetEase word-synced (YRC)
 * -> Genius-style plain text. NetEase is the only source with real word timings, so
 * word-by-word mode only ever activates when that lookup succeeds.
 */
object LyricsRemote {

    private val cache = object : LinkedHashMap<String, LyricDocument>(24, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, LyricDocument>?) = size > 40
    }

    suspend fun fetch(track: Track, custom: String? = null): LyricDocument {
        val key = "${track.key}|${track.title}|${track.artist}"
        synchronized(cache) { cache[key]?.let { return it } }

        if (!custom.isNullOrBlank()) {
            val doc = LyricsParser.parse(custom, LyricsSource.CUSTOM)
            if (!doc.isEmpty) {
                synchronized(cache) { cache[key] = doc }
                return doc
            }
        }

        val lrclib = lrclib(track)
        if (lrclib != null && !lrclib.isEmpty) {
            synchronized(cache) { cache[key] = lrclib }
            return lrclib
        }

        val words = netEaseWords(track)
        if (words != null && !words.isEmpty) {
            synchronized(cache) { cache[key] = words }
            return words
        }

        val doc = lrclib ?: LyricDocument.Empty
        synchronized(cache) { cache[key] = doc }
        return doc
    }

    fun cacheCustom(track: Track, text: String) {
        val key = "${track.key}|${track.title}|${track.artist}"
        synchronized(cache) { cache[key] = LyricsParser.parse(text, LyricsSource.CUSTOM) }
    }

    /* ------------------------------ LRCLIB ------------------------------ */

    private suspend fun lrclib(track: Track): LyricDocument? {
        val title = sanitize(track.title)
        val artist = sanitize(track.artist)
        if (title.isBlank()) return null

        val exact = "https://lrclib.net/api/get?track_name=${enc(title)}&artist_name=${enc(artist)}" +
            (if (track.album.isNotBlank()) "&album_name=${enc(sanitize(track.album))}" else "") +
            (if (track.durationMs > 0) "&duration=${track.durationMs / 1000}" else "")

        Api.getJson(exact, headers = mapOf("Lrclib-Client" to USER_AGENT))?.let { json ->
            val synced = json.str("syncedLyrics")
            val plain = json.str("plainLyrics")
            val payload = synced?.takeIf { it.isNotBlank() } ?: plain
            if (!payload.isNullOrBlank()) return LyricsParser.parse(payload, LyricsSource.LRCLIB)
        }

        val search = Api.getJson(
            "https://lrclib.net/api/search?q=${enc("$artist $title")}",
            headers = mapOf("Lrclib-Client" to USER_AGENT),
        )?.asObjects() ?: return null

        val best = search.firstOrNull { !it.str("syncedLyrics").isNullOrBlank() }
            ?: search.firstOrNull()
            ?: return null
        val payload = best.str("syncedLyrics")?.takeIf { it.isNotBlank() } ?: best.str("plainLyrics")
        return payload?.let { LyricsParser.parse(it, LyricsSource.LRCLIB) }
    }

    /* ------------------------------ NetEase ------------------------------ */

    private suspend fun netEaseWords(track: Track): LyricDocument? {
        val query = sanitize("${track.title} ${track.artist}")
        if (query.isBlank()) return null

        val searchJson = Api.getJson(
            "https://music.163.com/api/search/get?s=${enc(query)}&type=1&limit=5",
            headers = mapOf("Referer" to "https://music.163.com"),
        ) ?: Api.getJson(
            "https://music.163.com/api/search/get/web?s=${enc(query)}&type=1&limit=5",
            headers = mapOf("Referer" to "https://music.163.com"),
        ) ?: return null

        val songs = searchJson.at("result", "songs").asObjects()
        if (songs.isEmpty()) return null

        val targetSeconds = track.durationMs / 1000.0
        val match = songs.firstOrNull { song ->
            if (targetSeconds <= 0) return@firstOrNull false
            val dur = (song.num("dt") ?: song.num("duration") ?: 0L) / 1000.0
            dur > 0 && kotlin.math.abs(dur - targetSeconds) <= 5.0
        } ?: songs.firstOrNull()

        val id = match?.num("id") ?: return null
        val lyricJson = Api.getJson(
            "https://music.163.com/api/song/lyric?id=$id&lv=1&kv=1&tv=-1&yv=1",
            headers = mapOf("Referer" to "https://music.163.com"),
        ) ?: return null

        val yrc = lyricJson.at("yrc", "lyric")?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
        if (!yrc.isNullOrBlank()) {
            val parsed = LyricsParser.parseYrc(yrc.replace("\\n", "\n"))
            if (parsed.isNotEmpty()) {
                return LyricDocument(parsed, LyricsSource.NETEASE)
            }
        }

        val lrc = lyricJson.at("lrc", "lyric")?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
        if (!lrc.isNullOrBlank()) {
            return LyricsParser.parse(lrc.replace("\\n", "\n"), LyricsSource.NETEASE)
        }
        return null
    }

    /* ------------------------------ helpers ------------------------------ */

    private fun sanitize(value: String): String = value
        .replace(Regex("\\s*\\(feat\\.[^)]*\\)", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\[feat\\.[^\\]]*\\]", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\(featuring[^)]*\\)", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*feat\\.[^\\s]+", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*-\\s*remaster(ed)?(\\s*\\d+)?", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\(live[^)]*\\)", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\[live[^\\]]*\\]", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\((official|audio|video|lyrics?)[^)]*\\)", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s+"), " ")
        .trim()

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    private const val USER_AGENT = "melo/1.0 (https://github.com/hakosworld-blip/melo)"
}
