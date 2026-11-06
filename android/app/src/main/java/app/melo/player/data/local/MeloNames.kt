package app.melo.player.data.local

import app.melo.player.data.model.Track

/**
 * File naming for the melo folder. Pure Kotlin so the rules can be unit-tested on the JVM.
 */
object MeloNames {

    /** The folder itself: `Music/melo` on Android 10+, the app's own `Music/melo` below that. */
    const val FOLDER = "melo"

    private val ILLEGAL = Regex("[\\\\/:*?\"<>|]")
    private val WHITESPACE = Regex("\\s+")
    private val SLUG = Regex("[^\\p{L}\\p{N}]+")

    private val AUDIO_EXTENSIONS =
        setOf("m4a", "mp3", "aac", "ogg", "opus", "weba", "webm", "flac", "wav")

    /** `Artist - Title`, with anything a filesystem dislikes replaced. */
    fun fileBase(track: Track): String {
        val artist = sanitize(track.artist, "Unknown artist")
        val title = sanitize(track.title, "Untitled")
        return sanitize("$artist - $title", "song").take(96).trim().ifBlank { "song" }
    }

    fun sanitize(value: String, fallback: String): String =
        value.replace(ILLEGAL, "_").replace(WHITESPACE, " ").trim().ifBlank { fallback }

    fun baseName(fileName: String): String = fileName.substringBeforeLast('.', fileName)

    fun extensionOf(fileName: String): String = fileName.substringAfterLast('.', "").lowercase()

    fun isAudio(fileName: String): Boolean = extensionOf(fileName) in AUDIO_EXTENSIONS

    /** The container the stream really is, judged from the resolved URL. */
    fun extensionFor(url: String): String = when {
        url.contains(".mp3") -> "mp3"
        url.contains("mime=audio%2Fwebm") || url.contains("mime=audio/webm") -> "webm"
        url.contains(".webm") -> "webm"
        url.contains("mime=audio%2Fmp4") || url.contains("mime=audio/mp4") -> "m4a"
        url.contains(".m4a") || url.contains(".mp4") -> "m4a"
        url.contains(".opus") -> "opus"
        url.contains(".ogg") || url.contains("mime=audio%2Fogg") -> "ogg"
        url.contains(".flac") -> "flac"
        else -> "m4a"
    }

    fun mimeFor(extension: String): String = when (extension.lowercase()) {
        "mp3" -> "audio/mpeg"
        "m4a", "mp4", "aac" -> "audio/mp4"
        "webm", "weba" -> "audio/webm"
        "ogg", "opus" -> "audio/ogg"
        "flac" -> "audio/flac"
        "wav" -> "audio/wav"
        else -> "audio/mp4"
    }

    /** Stable identity for a file melo found in the folder rather than downloaded itself. */
    fun localId(fileName: String): String =
        baseName(fileName).lowercase().replace(SLUG, "-").trim('-').take(64).ifBlank { "file" }

    fun titleFromFile(fileName: String): String {
        val base = baseName(fileName)
        return base.substringAfter(" - ", base).trim().ifBlank { base }
    }
}
