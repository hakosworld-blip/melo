package app.melo.player.data.local

import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The `<song>.json` sidecar: everything melo knows about a song besides its audio, so the
 * folder can be copied to another phone — or read by another player — and still make sense.
 */
@Serializable
data class MeloMeta(
    val schema: Int = 1,
    val trackKey: String = "",
    val title: String = "",
    val artist: String = "",
    val album: String = "",
    val durationMs: Long = 0L,
    val explicit: Boolean = false,
    val source: String = "local",
    val providerId: String = "",
    val webUrl: String = "",
    val artworkUrl: String = "",
    val quality: String = "",
    val downloadedAt: Long = 0L,
    val lyricsSource: String = "none",
    val lyricsSynced: Boolean = false,
    val lyricsWordTimings: Boolean = false,
    val audioFile: String = "",
    val artworkFile: String = "",
    val lyricsFile: String = "",
) {

    /** Rebuilds the library entry for a file that is already in the folder. */
    fun toTrack(artworkRef: String?): Track = Track(
        id = providerId.ifBlank { MeloNames.localId(audioFile.ifBlank { title }) },
        title = title.ifBlank { MeloNames.titleFromFile(audioFile) },
        artist = artist.ifBlank { "Unknown artist" },
        album = album,
        durationMs = durationMs,
        artwork = artworkRef ?: artworkUrl,
        source = sourceOf(source),
        explicit = explicit,
        webUrl = webUrl,
    )

    companion object {
        /** Quality marker for a song melo found in the folder instead of downloading it. */
        const val LOCAL_QUALITY = "local"

        private fun sourceOf(value: String): Source =
            Source.entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: Source.LOCAL
    }
}

/** Reads and writes the sidecar. Pure, so it is testable without a device. */
object MeloMetaCodec {

    private val json = Json {
        prettyPrint = true
        encodeDefaults = true
        explicitNulls = false
        ignoreUnknownKeys = true
    }

    fun encode(meta: MeloMeta): String = json.encodeToString(MeloMeta.serializer(), meta)

    fun decode(text: String): MeloMeta? =
        runCatching { json.decodeFromString(MeloMeta.serializer(), text) }.getOrNull()
}
