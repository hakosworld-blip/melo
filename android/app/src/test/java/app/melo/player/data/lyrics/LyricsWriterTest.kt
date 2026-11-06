package app.melo.player.data.lyrics

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class LyricsWriterTest {

    @Test
    fun `line timings survive a round trip`() {
        val doc = LyricDocument(
            lines = listOf(
                LyricLine("we're up all night to get lucky", 12_340, 15_000),
                LyricLine("we're up all night to get some", 15_000, 18_000),
            ),
            source = LyricsSource.LRCLIB,
        )

        val lrc = LyricsWriter.toLrc(doc, title = "Get Lucky", artist = "Daft Punk", album = "RAM")
        val parsed = LyricsParser.parse(lrc)

        assertThat(parsed.lines).hasSize(2)
        assertThat(parsed.lines[0].text).isEqualTo("we're up all night to get lucky")
        assertThat(parsed.lines[1].text).isEqualTo("we're up all night to get some")
        assertThat(parsed.lines[0].startMs).isWithin(10L).of(12_340)
        assertThat(parsed.lines[1].startMs).isWithin(10L).of(15_000)
        assertThat(parsed.hasLineTiming).isTrue()
        assertThat(parsed.hasWordTiming).isFalse()
    }

    @Test
    fun `the artist and song are recorded in the file header`() {
        val doc = LyricDocument(listOf(LyricLine("line", 1_000, 2_000)), LyricsSource.LRCLIB)
        val lrc = LyricsWriter.toLrc(doc, title = "Get Lucky", artist = "Daft Punk", album = "RAM")

        assertThat(lrc).startsWith("[ar:Daft Punk]\n[ti:Get Lucky]\n[al:RAM]\n")
        // Header tags must never be mistaken for lyric lines.
        assertThat(LyricsParser.parse(lrc).lines).hasSize(1)
    }

    @Test
    fun `word timings are kept when the source really had them`() {
        val doc = LyricDocument(
            lines = listOf(
                LyricLine(
                    text = "we're up all night",
                    startMs = 12_340,
                    endMs = 15_000,
                    words = listOf(
                        LyricWord("we're", 12_340, 12_600),
                        LyricWord("up", 12_600, 12_900),
                        LyricWord("all", 12_900, 13_200),
                        LyricWord("night", 13_200, 13_800),
                    ),
                ),
            ),
            source = LyricsSource.NETEASE,
        )

        val parsed = LyricsParser.parse(LyricsWriter.toLrc(doc))

        assertThat(parsed.lines).hasSize(1)
        assertThat(parsed.hasWordTiming).isTrue()
        assertThat(parsed.lines[0].startMs).isWithin(10L).of(12_340)
        assertThat(parsed.lines[0].text).isEqualTo("we're up all night")

        val words = parsed.lines[0].words
        assertThat(words).hasSize(4)
        assertThat(words[0].text).isEqualTo("we're")
        assertThat(words[1].text).isEqualTo("up")
        assertThat(words[1].startMs).isWithin(10L).of(12_600)
        assertThat(words[2].startMs).isWithin(10L).of(12_900)
        assertThat(words[3].startMs).isWithin(10L).of(13_200)
    }

    @Test
    fun `plain lyrics stay plain, with no invented timings`() {
        val doc = LyricsParser.parse("just some lines\nwith no timings at all")

        val lrc = LyricsWriter.toLrc(doc)

        assertThat(lrc).doesNotContain("[00:")
        assertThat(lrc).doesNotContain("<00:")

        val parsed = LyricsParser.parse(lrc)
        assertThat(parsed.hasLineTiming).isFalse()
        assertThat(parsed.hasWordTiming).isFalse()
        assertThat(parsed.plain).isEqualTo("just some lines\nwith no timings at all")
    }

    @Test
    fun `an empty document writes an empty file`() {
        assertThat(LyricsWriter.toLrc(LyricDocument.Empty)).isEmpty()
        assertThat(LyricsWriter.toLrc(LyricsParser.parse("   "))).isEmpty()
    }

    @Test
    fun `stamps are locale independent`() {
        assertThat(LyricsWriter.stamp(0)).isEqualTo("[00:00.00]")
        assertThat(LyricsWriter.stamp(62_340)).isEqualTo("[01:02.34]")
        assertThat(LyricsWriter.wordStamp(3_600_000)).isEqualTo("<60:00.00>")
    }
}
