package app.melo.player.data.lyrics

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class LyricsParserTest {

    @Test
    fun `parses plain lrc with line timestamps`() {
        val lrc = """
            [ar:Someone]
            [ti:A Song]
            [00:12.00]First line
            [00:15.50]Second line
            [01:02.25]Third line
        """.trimIndent()

        val doc = LyricsParser.parse(lrc, LyricsSource.LRCLIB)

        assertThat(doc.lines).hasSize(3)
        assertThat(doc.lines[0].text).isEqualTo("First line")
        assertThat(doc.lines[0].startMs).isEqualTo(12_000)
        assertThat(doc.lines[0].endMs).isEqualTo(15_500)
        assertThat(doc.lines[1].startMs).isEqualTo(15_500)
        assertThat(doc.lines[2].startMs).isEqualTo(62_250)
        assertThat(doc.hasLineTiming).isTrue()
        assertThat(doc.hasWordTiming).isFalse()
        assertThat(doc.source).isEqualTo(LyricsSource.LRCLIB)
    }

    @Test
    fun `repeated timestamps duplicate a line`() {
        val lrc = "[00:10.00][00:30.00]Chorus"
        val doc = LyricsParser.parse(lrc)
        assertThat(doc.lines).hasSize(2)
        assertThat(doc.lines.map { it.startMs }).containsExactly(10_000L, 30_000L).inOrder()
    }

    @Test
    fun `enhanced lrc yields word timings`() {
        val lrc = "[00:10.00]<00:10.00>Hello <00:11.00>world"
        val doc = LyricsParser.parse(lrc)

        assertThat(doc.lines).hasSize(1)
        val line = doc.lines.first()
        assertThat(line.text).isEqualTo("Hello world")
        assertThat(line.words).hasSize(2)
        assertThat(line.words[0].text).isEqualTo("Hello")
        assertThat(line.words[0].startMs).isEqualTo(10_000)
        assertThat(line.words[1].startMs).isEqualTo(11_000)
        assertThat(doc.hasWordTiming).isTrue()
    }

    @Test
    fun `parses netease yrc word timing`() {
        val yrc = "[1000,2000](1000,500,0)Hello (1500,500,0)world"
        val lines = LyricsParser.parseYrc(yrc)

        assertThat(lines).hasSize(1)
        val line = lines.first()
        assertThat(line.startMs).isEqualTo(1000)
        assertThat(line.endMs).isEqualTo(3000)
        assertThat(line.text).isEqualTo("Hello world")
        assertThat(line.words).hasSize(2)
        assertThat(line.words[0].startMs).isEqualTo(1000)
        assertThat(line.words[1].startMs).isEqualTo(1500)
    }

    @Test
    fun `yrc metadata lines are dropped`() {
        val yrc = "[0,1000](0,100,0)作词\n[0,1000](0,100,0)作曲\n[1000,1000](1000,500,0)Real line"
        val lines = LyricsParser.parseYrc(yrc)
        assertThat(lines).hasSize(1)
        assertThat(lines.first().text).isEqualTo("Real line")
    }

    @Test
    fun `plain text falls back without inventing timings`() {
        val doc = LyricsParser.parse("just some words\nand more words")

        assertThat(doc.hasLineTiming).isFalse()
        assertThat(doc.hasWordTiming).isFalse()
        assertThat(doc.lines).hasSize(2)
        assertThat(doc.supportedMode(LyricsMode.WORD)).isEqualTo(LyricsMode.PLAIN)
        assertThat(doc.supportedMode(LyricsMode.LINE)).isEqualTo(LyricsMode.PLAIN)
    }

    @Test
    fun `word mode downgrades when only line timings exist`() {
        val doc = LyricsParser.parse("[00:01.00]One\n[00:02.00]Two")
        assertThat(doc.hasLineTiming).isTrue()
        assertThat(doc.supportedMode(LyricsMode.WORD)).isEqualTo(LyricsMode.LINE)
        assertThat(doc.supportedMode(LyricsMode.LINE)).isEqualTo(LyricsMode.LINE)
    }

    @Test
    fun `word mode is honoured when word timings exist`() {
        val doc = LyricsParser.parse("[00:10.00]<00:10.00>Hello <00:11.00>world")
        assertThat(doc.supportedMode(LyricsMode.WORD)).isEqualTo(LyricsMode.WORD)
    }

    @Test
    fun `offset tag shifts timings`() {
        val doc = LyricsParser.parse("[offset:+500]\n[00:10.00]Line")
        assertThat(doc.lines.first().startMs).isEqualTo(9_500)
    }

    @Test
    fun `empty input is empty and not timed`() {
        val doc = LyricsParser.parse("")
        assertThat(doc.isEmpty).isTrue()
        assertThat(doc.hasLineTiming).isFalse()
    }

    @Test
    fun `last line gets a reading window`() {
        val doc = LyricsParser.parse("[00:10.00]Only line")
        val line = doc.lines.first()
        assertThat(line.endMs).isGreaterThan(line.startMs)
    }
}
