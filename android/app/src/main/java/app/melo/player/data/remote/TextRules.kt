package app.melo.player.data.remote

/**
 * Small text rules shared by providers. Kept in one place so search, imports and
 * dedupe all normalise titles identically.
 */
object TextRules {

    private val EXPLICIT_HINTS = Regex(
        "\\b(fuck|fucking|fucked|shit|bitch|bitches|asshole|cunt|dick|pussy)\\b|" +
            "ху[йеяёюи]|пизд|залуп|муда[кч]|дерьм|дроч|" +
            "(?:^|[^а-яё])(?:бля[а-яё]*|сук[аиуео]|суч[екьяа][а-яё]*|" +
            "[её]б[а-яё]+|(?:вы|за|на|до|по|пере|про|разъ|раз|съ|въ|под|от|у)[её]б[а-яё]*)",
        RegexOption.IGNORE_CASE,
    )

    fun looksExplicit(text: String?): Boolean =
        !text.isNullOrBlank() && EXPLICIT_HINTS.containsMatchIn(text)

    private val NOISE = Regex(
        "\\s*[(\\[][^)\\]]*(official|audio|video|lyrics|visualizer|remaster|клип|трек|prod|" +
            "feat|ft|slowed|reverb|remix|live|hd|4k)[^)\\]]*[)\\]]",
        RegexOption.IGNORE_CASE,
    )

    private val SUFFIX_NOISE = Regex(
        "\\s*(official\\s*(music)?\\s*video|official\\s*audio|lyrics|hd|4k|remaster(ed)?|visualizer)",
        RegexOption.IGNORE_CASE,
    )

    private val PUNCT = Regex("[()\\[\\]{}<>\\-–—_/\\\\\"',.:;!?]")

    /** Title with decoration stripped, for matching an import against the catalog. */
    fun cleanTitle(title: String?): String =
        (title ?: "")
            .replace(NOISE, " ")
            .replace(SUFFIX_NOISE, " ")
            .replace(PUNCT, " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    fun normalizeKey(title: String?, artist: String?): String {
        val t = cleanTitle(title).lowercase().replace(Regex("[^\\p{L}\\p{N}]"), "")
        val a = (artist ?: "")
            .replace(Regex("\\b(official|vevo|records|topic)\\b", RegexOption.IGNORE_CASE), " ")
            .lowercase()
            .replace(Regex("[^\\p{L}\\p{N}]"), "")
        return "$a|$t"
    }

    fun normalizeArtist(name: String?): String =
        (name ?: "")
            .replace(Regex("\\b(official|vevo|records|topic)\\b", RegexOption.IGNORE_CASE), " ")
            .replace(Regex("[^\\p{L}\\p{N}\\s&-]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    /** Loose similarity used to rank import matches. 0..1 */
    fun similarity(a: String?, b: String?): Double {
        if (a.isNullOrBlank() || b.isNullOrBlank()) return 0.0
        val x = normalizeKey(a, "")
        val y = normalizeKey(b, "")
        if (x.isBlank() || y.isBlank()) return 0.0
        if (x == y) return 1.0
        if (x.contains(y) || y.contains(x)) return 0.86
        val dist = levenshtein(x, y)
        val max = maxOf(x.length, y.length)
        return if (max == 0) 0.0 else (1.0 - dist.toDouble() / max).coerceIn(0.0, 1.0)
    }

    private fun levenshtein(a: String, b: String): Int {
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        var prev = IntArray(b.length + 1) { it }
        var cur = IntArray(b.length + 1)
        for (i in 1..a.length) {
            cur[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                cur[j] = minOf(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
            }
            val tmp = prev; prev = cur; cur = tmp
        }
        return prev[b.length]
    }
}
