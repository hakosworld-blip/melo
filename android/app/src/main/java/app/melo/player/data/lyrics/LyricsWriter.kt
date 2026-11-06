package app.melo.player.data.lyrics

import java.util.Locale

/**
 * Writes a [LyricDocument] back out as LRC, the format melo and most other players read.
 *
 * Word timings are written only when the source really carried them; plain lyrics stay
 * plain rather than being given timings nobody measured. The output is round-trippable
 * through [LyricsParser], which is what the download of a song relies on.
 */
object LyricsWriter {

    fun toLrc(
        doc: LyricDocument,
        title: String = "",
        artist: String = "",
        album: String = "",
    ): String {
        if (doc.isEmpty) return ""

        val out = StringBuilder()
        if (artist.isNotBlank()) out.append("[ar:").append(artist).append("]\n")
        if (title.isNotBlank()) out.append("[ti:").append(title).append("]\n")
        if (album.isNotBlank()) out.append("[al:").append(album).append("]\n")

        val timed = doc.lines.filter { it.startMs >= 0 }
        if (timed.isEmpty()) {
            out.append(doc.plain.ifBlank { doc.lines.joinToString("\n") { it.text } }.trim())
            return out.toString()
        }

        timed.forEach { line ->
            out.append(stamp(line.startMs))
            if (line.words.isEmpty()) {
                out.append(line.text)
            } else {
                line.words.forEach { word ->
                    out.append(wordStamp(word.startMs.coerceAtLeast(0L))).append(word.text).append(' ')
                }
            }
            out.append('\n')
        }
        return out.toString()
    }

    /** `[mm:ss.xx]`, the centisecond precision LRC carries. */
    fun stamp(ms: Long): String = "[${time(ms)}]"

    /** `<mm:ss.xx>`, the enhanced-LRC per-word stamp. */
    fun wordStamp(ms: Long): String = "<${time(ms)}>"

    /** Locale-independent so timings never come out in non-Latin digits. */
    private fun time(ms: Long): String {
        val total = ms.coerceAtLeast(0L)
        val minutes = total / 60_000
        val seconds = (total % 60_000) / 1000
        val centiseconds = (total % 1000) / 10
        return String.format(Locale.US, "%02d:%02d.%02d", minutes, seconds, centiseconds)
    }
}
