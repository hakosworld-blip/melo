package app.melo.player.data.lyrics

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class LyricsSyncTest {

    private val lines = listOf(
        LyricLine("one", 0, 5_000),
        LyricLine("two", 5_000, 10_000),
        LyricLine("three", 10_000, 15_000),
    )

    @Test
    fun `no active line before the first timestamp`() {
        assertThat(LyricsSync.activeLine(lines, -1)).isEqualTo(-1)
    }

    @Test
    fun `exact boundaries select the later line`() {
        assertThat(LyricsSync.activeLine(lines, 0)).isEqualTo(0)
        assertThat(LyricsSync.activeLine(lines, 5_000)).isEqualTo(1)
        assertThat(LyricsSync.activeLine(lines, 10_000)).isEqualTo(2)
    }

    @Test
    fun `positions between and after timestamps`() {
        assertThat(LyricsSync.activeLine(lines, 7_321)).isEqualTo(1)
        assertThat(LyricsSync.activeLine(lines, 99_999)).isEqualTo(2)
    }

    @Test
    fun `empty list has no active line`() {
        assertThat(LyricsSync.activeLine(emptyList(), 1_000)).isEqualTo(-1)
    }

    @Test
    fun `active word advances with the position`() {
        val line = LyricLine(
            text = "a b c",
            startMs = 0,
            endMs = 3_000,
            words = listOf(
                LyricWord("a", 0, 1_000),
                LyricWord("b", 1_000, 2_000),
                LyricWord("c", 2_000, 3_000),
            ),
        )
        assertThat(LyricsSync.activeWord(line, -10)).isEqualTo(-1)
        assertThat(LyricsSync.activeWord(line, 0)).isEqualTo(0)
        assertThat(LyricsSync.activeWord(line, 1_500)).isEqualTo(1)
        assertThat(LyricsSync.activeWord(line, 2_999)).isEqualTo(2)
        assertThat(LyricsSync.activeWord(null, 1_000)).isEqualTo(-1)
    }

    @Test
    fun `word progress is clamped`() {
        val word = LyricWord("x", 1_000, 2_000)
        assertThat(LyricsSync.wordProgress(word, 500)).isEqualTo(0f)
        assertThat(LyricsSync.wordProgress(word, 1_500)).isWithin(0.01f).of(0.5f)
        assertThat(LyricsSync.wordProgress(word, 9_000)).isEqualTo(1f)
        assertThat(LyricsSync.wordProgress(null, 1_000)).isEqualTo(0f)
    }

    @Test
    fun `line progress is clamped`() {
        assertThat(LyricsSync.lineProgress(lines[1], 5_000)).isEqualTo(0f)
        assertThat(LyricsSync.lineProgress(lines[1], 7_500)).isWithin(0.01f).of(0.5f)
        assertThat(LyricsSync.lineProgress(lines[1], 20_000)).isEqualTo(1f)
    }

    @Test
    fun `time formatting handles long tracks`() {
        assertThat(LyricsSync.formatTime(0)).isEqualTo("0:00")
        assertThat(LyricsSync.formatTime(65_000)).isEqualTo("1:05")
        assertThat(LyricsSync.formatTime(-5)).isEqualTo("0:00")
    }

    @Test
    fun `mode ids round trip and fall back`() {
        assertThat(LyricsMode.fromId("word")).isEqualTo(LyricsMode.WORD)
        assertThat(LyricsMode.fromId("plain")).isEqualTo(LyricsMode.PLAIN)
        assertThat(LyricsMode.fromId("nonsense")).isEqualTo(LyricsMode.LINE)
        assertThat(LyricsMode.fromId(null)).isEqualTo(LyricsMode.LINE)
    }
}
