package app.melo.player.data.local

import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class MeloNamesTest {

    private fun track(title: String, artist: String) = Track(
        id = "abc123",
        title = title,
        artist = artist,
        source = Source.YOUTUBE,
    )

    @Test
    fun `file base keeps the artist and the song`() {
        assertThat(MeloNames.fileBase(track("Get Lucky", "Daft Punk")))
            .isEqualTo("Daft Punk - Get Lucky")
    }

    @Test
    fun `file base strips what a filesystem refuses`() {
        val base = MeloNames.fileBase(track("AC/DC: Back? <live>", "AC/DC"))
        listOf('/', ':', '?', '<', '>', '\\', '"', '*', '|').forEach { character ->
            assertThat(base).doesNotContain(character.toString())
        }
        assertThat(base).contains("AC_DC")
    }

    @Test
    fun `file base never comes back empty`() {
        assertThat(MeloNames.fileBase(track("", ""))).isEqualTo("Unknown artist - Untitled")
        assertThat(MeloNames.fileBase(track("   ", "  "))).isEqualTo("Unknown artist - Untitled")
    }

    @Test
    fun `extension follows the container the stream really is`() {
        assertThat(MeloNames.extensionFor("https://x/y?mime=audio%2Fmp4&expire=1")).isEqualTo("m4a")
        assertThat(MeloNames.extensionFor("https://x/y?mime=audio%2Fwebm")).isEqualTo("webm")
        assertThat(MeloNames.extensionFor("https://x/y/track.mp3?token=1")).isEqualTo("mp3")
    }

    @Test
    fun `mime and audio detection line up with the extension`() {
        assertThat(MeloNames.mimeFor("m4a")).isEqualTo("audio/mp4")
        assertThat(MeloNames.mimeFor("mp3")).isEqualTo("audio/mpeg")
        assertThat(MeloNames.mimeFor("webm")).isEqualTo("audio/webm")

        assertThat(MeloNames.isAudio("Daft Punk - Get Lucky.m4a")).isTrue()
        assertThat(MeloNames.isAudio("Daft Punk - Get Lucky.MP3")).isTrue()
        assertThat(MeloNames.isAudio("Daft Punk - Get Lucky.lrc")).isFalse()
        assertThat(MeloNames.isAudio("Daft Punk - Get Lucky.json")).isFalse()
        assertThat(MeloNames.isAudio("Daft Punk - Get Lucky.jpg")).isFalse()
    }

    @Test
    fun `base name drops only the last extension`() {
        assertThat(MeloNames.baseName("A - B (2).m4a")).isEqualTo("A - B (2)")
        assertThat(MeloNames.baseName("no extension here")).isEqualTo("no extension here")
    }

    @Test
    fun `the local id is stable and usable as a track id`() {
        val first = MeloNames.localId("Daft Punk - Get Lucky.m4a")
        assertThat(first).isEqualTo(MeloNames.localId("Daft Punk - Get Lucky.m4a"))
        assertThat(first).isNotEqualTo(MeloNames.localId("Daft Punk - Around the World.m4a"))
        assertThat(first).doesNotContain(" ")
        assertThat(first).doesNotContain("/")
    }

    @Test
    fun `a file name is split back into artist and song`() {
        assertThat(MeloNames.titleFromFile("Daft Punk - Get Lucky.m4a")).isEqualTo("Get Lucky")
        assertThat(MeloNames.titleFromFile("Mystery Track.m4a")).isEqualTo("Mystery Track")
    }
}
