package app.melo.player.data.lyrics

/**
 * Lyric parsing and synchronisation. Deliberately free of Android imports so the
 * timing rules can be unit-tested on the JVM.
 *
 * Supported inputs, in the same order the desktop app tried them:
 *  - LRC with line timestamps `[mm:ss.xx]`, optionally several stamps per line
 *  - Enhanced LRC with word timestamps `<mm:ss.xx>`
 *  - NetEase YRC, the only source in the desktop app that supplies genuine
 *    word-level timings
 *  - plain text (no timings at all)
 */
data class LyricWord(
    val text: String,
    val startMs: Long,
    val endMs: Long,
)

data class LyricLine(
    val text: String,
    val startMs: Long,
    val endMs: Long,
    val words: List<LyricWord> = emptyList(),
)

enum class LyricsMode(val id: String, val label: String) {
    WORD("word", "Word by word"),
    LINE("line", "Line by line"),
    PLAIN("plain", "Plain lyrics");

    companion object {
        fun fromId(id: String?): LyricsMode = entries.firstOrNull { it.id == id } ?: LINE
    }
}

enum class LyricsSource(val id: String, val label: String) {
    CUSTOM("custom", "Custom / from file"),
    LRCLIB("lrclib", "LRCLIB"),
    NETEASE("netease", "NetEase word sync"),
    NONE("none", "None");

    companion object {
        fun fromId(id: String?): LyricsSource = entries.firstOrNull { it.id == id } ?: NONE
    }
}

data class LyricDocument(
    val lines: List<LyricLine>,
    val source: LyricsSource,
    val plain: String = "",
) {
    /** True only when real timestamps exist, never inferred from plain text. */
    val hasLineTiming: Boolean get() = lines.any { it.startMs >= 0 && (it.endMs > it.startMs) }
    val hasWordTiming: Boolean get() = lines.any { it.words.isNotEmpty() }

    /** The best mode this document can honestly support. */
    fun supportedMode(preferred: LyricsMode): LyricsMode = when {
        lines.isEmpty() -> LyricsMode.PLAIN
        !hasLineTiming -> LyricsMode.PLAIN
        preferred == LyricsMode.WORD && hasWordTiming -> LyricsMode.WORD
        preferred == LyricsMode.PLAIN -> LyricsMode.PLAIN
        else -> LyricsMode.LINE
    }

    val isEmpty: Boolean get() = plain.isBlank() && lines.isEmpty()

    companion object {
        val Empty = LyricDocument(emptyList(), LyricsSource.NONE)
    }
}

object LyricsParser {

    private val LINE_STAMP = Regex("""\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?]""")
    private val WORD_STAMP = Regex("""<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>""")
    private val OFFSET_TAG = Regex("""\[offset:\s*([+-]?\d+)]""", RegexOption.IGNORE_CASE)
    private val META_TAG = Regex("""^\[(ar|ti|al|by|re|ve|length|offset):.*]$""", RegexOption.IGNORE_CASE)

    /**
     * Parse a payload of unknown flavour into a [LyricDocument].
     * Never throws: unparseable input degrades to plain text.
     */
    fun parse(raw: String?, source: LyricsSource = LyricsSource.LRCLIB): LyricDocument {
        if (raw.isNullOrBlank()) return LyricDocument.Empty
        val normalized = raw.replace("\r\n", "\n").replace('\r', '\n')

        val offset = OFFSET_TAG.find(normalized)?.groupValues?.get(1)?.toLongOrNull() ?: 0L

        val yrc = parseYrc(normalized)
        if (yrc.isNotEmpty()) {
            return LyricDocument(
                lines = applyOffset(yrc, offset),
                source = LyricsSource.NETEASE,
            )
        }

        val lrc = parseLrc(normalized)
        if (lrc.isNotEmpty()) {
            return LyricDocument(
                lines = applyOffset(lrc, offset),
                source = source,
            )
        }

        val plain = plainText(normalized)
        return LyricDocument(
            lines = plain.lines().map { LyricLine(it, -1L, -1L) },
            source = if (plain.isBlank()) LyricsSource.NONE else source,
            plain = plain,
        )
    }

    /** Standard LRC, plus enhanced per-word timestamps when present. */
    fun parseLrc(text: String): List<LyricLine> {
        val out = mutableListOf<LyricLine>()
        for (rawLine in text.split('\n')) {
            val line = rawLine.trim()
            if (line.isEmpty()) continue
            if (META_TAG.matches(line)) continue

            val stamps = LINE_STAMP.findAll(line).toList()
            if (stamps.isEmpty()) continue
            val content = line.substring(stamps.last().range.last + 1)

            val words = parseEnhancedWords(content)
            val lineText = if (words.isNotEmpty()) {
                words.joinToString(" ") { it.text.trim() }.replace(Regex("""\s+"""), " ").trim()
            } else {
                content.replace(WORD_STAMP, "").trim()
            }

            val first = stamps.first()
            val base = stampTimeMs(first.groupValues[1], first.groupValues[2], first.groupValues[3])
            for (stamp in stamps) {
                val start = stampTimeMs(stamp.groupValues[1], stamp.groupValues[2], stamp.groupValues[3])
                val shift = start - base
                out += LyricLine(
                    text = lineText,
                    startMs = start,
                    endMs = -1L, // filled in later from the following line
                    words = words.map {
                        it.copy(startMs = it.startMs + shift, endMs = it.endMs + shift)
                    },
                )
            }
        }
        val sorted = out.filter { it.text.isNotBlank() }.sortedBy { it.startMs }
        return fillEnds(sorted)
    }

    private fun parseEnhancedWords(content: String): List<LyricWord> {
        val matches = WORD_STAMP.findAll(content).toList()
        if (matches.isEmpty()) return emptyList()
        val words = mutableListOf<LyricWord>()
        for ((i, m) in matches.withIndex()) {
            val start = stampTimeMs(m.groupValues[1], m.groupValues[2], m.groupValues[3])
            val nextStart = if (i + 1 < matches.size) {
                stampTimeMs(
                    matches[i + 1].groupValues[1],
                    matches[i + 1].groupValues[2],
                    matches[i + 1].groupValues[3],
                )
            } else {
                -1L
            }
            val text = content.substring(m.range.last + 1, (matches.getOrNull(i + 1)?.range?.first ?: content.length))
            if (text.isBlank()) continue
            words += LyricWord(text = text.trim(), startMs = start, endMs = nextStart)
        }
        return words
    }

    /**
     * NetEase YRC: `[lineStartMs,lineDurationMs](wordStartMs,wordDurMs,0)text...`
     * Ported from the desktop server (parseYrc/parseYrcWords).
     */
    fun parseYrc(text: String): List<LyricLine> {
        val out = mutableListOf<LyricLine>()
        val lineRegex = Regex("""^\[(\d+),(\d+)](.*)$""")
        for (raw in text.split('\n')) {
            val trimmed = raw.trim()
            if (trimmed.isEmpty()) continue
            val m = lineRegex.matchEntire(trimmed) ?: continue
            val startMs = m.groupValues[1].toLongOrNull() ?: continue
            val durMs = m.groupValues[2].toLongOrNull() ?: 0L
            val rest = m.groupValues[3]
            val words = parseYrcWords(rest)
            if (words.isEmpty()) continue
            val full = words.joinToString(" ") { it.text }
                .replace(Regex("""\s+"""), " ")
                .trim()
            if (full.isEmpty()) continue
            if (full.startsWith("作词") || full.startsWith("作曲") || full.startsWith("制作人")) continue
            out += LyricLine(
                text = full,
                startMs = startMs,
                endMs = if (durMs > 0) startMs + durMs else -1L,
                words = words,
            )
        }
        return fillEnds(out.sortedBy { it.startMs })
    }

    private fun parseYrcWords(rest: String): List<LyricWord> {
        val wordRegex = Regex("""\((\d+),(\d+)(?:,\d+)?\)([^(]*)""")
        val words = mutableListOf<LyricWord>()
        var current: LyricWord? = null
        for (m in wordRegex.findAll(rest)) {
            val wStart = m.groupValues[1].toLongOrNull() ?: continue
            val wDur = m.groupValues[2].toLongOrNull() ?: 0L
            val rawText = m.groupValues[3]
            val isCjk = CJK.containsMatchIn(rawText)

            val c = current
            if (c != null && (isCjk || CJK.containsMatchIn(c.text))) {
                val trimmed = c.text.trim()
                if (trimmed.isNotEmpty()) words += c.copy(text = trimmed)
                current = null
            }

            current = when (val cur = current) {
                null -> LyricWord(rawText, wStart, wStart + wDur)
                else -> cur.copy(text = cur.text + rawText, endMs = maxOf(cur.endMs, wStart + wDur))
            }

            if (rawText.any { it.isWhitespace() } || isCjk) {
                val trimmed = current!!.text.trim()
                if (trimmed.isNotEmpty()) words += current!!.copy(text = trimmed)
                current = null
            }
        }
        current?.let {
            val trimmed = it.text.trim()
            if (trimmed.isNotEmpty()) words += it.copy(text = trimmed)
        }
        return words
    }

    private val CJK = Regex("""[\u4e00-\u9fa5\u3040-\u30ff]""")

    private fun stampTimeMs(min: String, sec: String, frac: String): Long {
        val m = min.toLongOrNull() ?: 0L
        val s = sec.toLongOrNull() ?: 0L
        val f = when (frac.length) {
            0 -> 0L
            1 -> frac.toLong() * 100
            2 -> frac.toLong() * 10
            else -> frac.take(3).toLong()
        }
        return (m * 60_000) + (s * 1_000) + f
    }

    /** Plain text with markup and metadata removed, preserving line structure. */
    fun plainText(text: String): String =
        text.split('\n')
            .map { it.replace(LINE_STAMP, "").replace(WORD_STAMP, "").trim() }
            .filter { it.isNotEmpty() && !META_TAG.matches(it) }
            .joinToString("\n")

    private fun applyOffset(lines: List<LyricLine>, offsetMs: Long): List<LyricLine> {
        if (offsetMs == 0L) return lines
        return lines.map { line ->
            line.copy(
                startMs = line.startMs - offsetMs,
                endMs = if (line.endMs > 0) line.endMs - offsetMs else line.endMs,
                words = line.words.map { it.copy(startMs = it.startMs - offsetMs, endMs = it.endMs - offsetMs) },
            )
        }
    }

    /**
     * Give each line an end time. A line ends at the next line's start, or after a
     * sensible reading window for the final line so the UI still has something to work with.
     */
    private fun fillEnds(sorted: List<LyricLine>): List<LyricLine> {
        if (sorted.isEmpty()) return sorted
        val out = ArrayList<LyricLine>(sorted.size)
        for (i in sorted.indices) {
            val cur = sorted[i]
            val next = sorted.getOrNull(i + 1)
            val end = when {
                cur.endMs > cur.startMs -> cur.endMs
                next != null -> next.startMs
                else -> cur.startMs + 4_000L
            }
            out += cur.copy(
                endMs = end,
                words = fillWordEnds(cur.words, end),
            )
        }
        return out
    }

    private fun fillWordEnds(words: List<LyricWord>, lineEnd: Long): List<LyricWord> {
        if (words.isEmpty()) return words
        return words.mapIndexed { i, w ->
            if (w.endMs > w.startMs) w
            else {
                val next = words.getOrNull(i + 1)
                w.copy(endMs = next?.startMs ?: lineEnd)
            }
        }
    }
}

/**
 * Maps a playback position onto lyric lines/words. Pure functions only, so the
 * highlighting rules are testable without a player.
 */
object LyricsSync {

    /** Index of the line that should be highlighted at [positionMs], or -1 before the first. */
    fun activeLine(lines: List<LyricLine>, positionMs: Long): Int {
        if (lines.isEmpty()) return -1
        if (positionMs < lines.first().startMs) return -1
        var lo = 0
        var hi = lines.lastIndex
        var result = 0
        while (lo <= hi) {
            val mid = (lo + hi) / 2
            if (lines[mid].startMs <= positionMs) {
                result = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        return result
    }

    /** Index of the word in [line] being sung at [positionMs], or -1. */
    fun activeWord(line: LyricLine?, positionMs: Long): Int {
        val words = line?.words ?: return -1
        if (words.isEmpty()) return -1
        var result = -1
        for ((i, w) in words.withIndex()) {
            if (w.startMs <= positionMs) result = i else break
        }
        return result
    }

    /** Fraction 0..1 through the current word, for smooth per-word progress. */
    fun wordProgress(word: LyricWord?, positionMs: Long): Float {
        if (word == null) return 0f
        val span = (word.endMs - word.startMs).coerceAtLeast(1L)
        return ((positionMs - word.startMs).toFloat() / span).coerceIn(0f, 1f)
    }

    /**
     * How far the active word is through its own duration, used to animate the
     * karaoke fill. Returns 0 when there is nothing to animate.
     */
    fun lineProgress(line: LyricLine?, positionMs: Long): Float {
        if (line == null) return 0f
        val span = (line.endMs - line.startMs).coerceAtLeast(1L)
        return ((positionMs - line.startMs).toFloat() / span).coerceIn(0f, 1f)
    }

    fun formatTime(ms: Long): String {
        val total = (ms.coerceAtLeast(0)) / 1000
        val m = total / 60
        val s = total % 60
        return "%d:%02d".format(m, s)
    }
}
