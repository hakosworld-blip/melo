package app.melo.player.data.remote

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class TextRulesTest {

    @Test
    fun `cleanTitle strips decorations`() {
        assertThat(TextRules.cleanTitle("Song Name (Official Video)"))
            .isEqualTo("Song Name")
        assertThat(TextRules.cleanTitle("Track [Lyrics]"))
            .isEqualTo("Track")
        // Punctuation is stripped because the result is only ever used for matching.
        assertThat(TextRules.cleanTitle("Artist - Song (Remastered 2011)"))
            .isEqualTo("Artist Song")
    }

    @Test
    fun `normalizeKey matches decorated and plain titles`() {
        val a = TextRules.normalizeKey("Numb (Official Music Video)", "Linkin Park")
        val b = TextRules.normalizeKey("Numb", "Linkin Park")
        assertThat(a).isEqualTo(b)
    }

    @Test
    fun `normalizeKey ignores topic suffix on artist`() {
        val a = TextRules.normalizeKey("Song", "Artist - Topic")
        val b = TextRules.normalizeKey("Song", "Artist")
        assertThat(a).isEqualTo(b)
    }

    @Test
    fun `similarity is high for near matches and low for unrelated`() {
        assertThat(TextRules.similarity("Blinding Lights", "Blinding Lights")).isEqualTo(1.0)
        assertThat(TextRules.similarity("Blinding Lights", "Blinding Light")).isGreaterThan(0.8)
        assertThat(TextRules.similarity("Blinding Lights", "Bohemian Rhapsody")).isLessThan(0.5)
    }

    @Test
    fun `similarity handles empty input`() {
        assertThat(TextRules.similarity("", "anything")).isEqualTo(0.0)
    }

    @Test
    fun `explicit detection uses words not substrings`() {
        assertThat(TextRules.looksExplicit("Title (Explicit)")).isFalse()
        assertThat(TextRules.looksExplicit("Shit Happens")).isTrue()
        assertThat(TextRules.looksExplicit("Scunthorpe Song")).isFalse()
        assertThat(TextRules.looksExplicit("")).isFalse()
    }

    @Test
    fun `normalizeArtist removes channel noise`() {
        assertThat(TextRules.normalizeArtist("Artist Official")).isEqualTo("Artist")
        assertThat(TextRules.normalizeArtist("Artist VEVO")).isEqualTo("Artist")
    }
}
