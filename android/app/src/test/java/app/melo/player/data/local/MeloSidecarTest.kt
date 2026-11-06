package app.melo.player.data.local

import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The rules that match a playing track back to the files melo saved beside it. Getting
 * these wrong means a downloaded song silently falls back to the network for its lyrics.
 */
class MeloSidecarTest {

    private fun file(name: String, ref: String = "content://media/external/file/1") =
        MeloFolder.FolderFile(
            name = name,
            ref = ref,
            mime = "audio/mp4",
            size = 1_024L,
            modified = 0L,
        )

    private val track = Track(
        id = "abc123",
        title = "Get Lucky",
        artist = "Daft Punk",
        source = Source.YOUTUBE,
    )

    @Test
    fun `the library row names the files`() {
        val base = MeloSidecar.baseNameFor(
            track,
            rowPath = "Daft Punk - Get Lucky.m4a",
            audioFiles = emptyList(),
        )
        assertThat(base).isEqualTo("Daft Punk - Get Lucky")
    }

    @Test
    fun `a track played straight out of the folder is matched by its file reference`() {
        val ref = "content://media/external/file/99"
        val base = MeloSidecar.baseNameFor(
            track.copy(source = Source.LOCAL, streamUrl = ref),
            rowPath = null,
            audioFiles = listOf(file("Daft Punk - Something Else.m4a", "content://x"), file("Daft Punk - Get Lucky.m4a", ref)),
        )
        assertThat(base).isEqualTo("Daft Punk - Get Lucky")
    }

    @Test
    fun `a song with no row falls back to the name melo would have given it`() {
        val base = MeloSidecar.baseNameFor(
            track,
            rowPath = "",
            audioFiles = listOf(file("Daft Punk - Get Lucky.m4a")),
        )
        assertThat(base).isEqualTo("Daft Punk - Get Lucky")
    }

    @Test
    fun `a remote stream url is never mistaken for a folder file`() {
        val base = MeloSidecar.baseNameFor(
            track.copy(streamUrl = "https://example.com/get-lucky.m4a"),
            rowPath = null,
            audioFiles = listOf(file("Daft Punk - Get Lucky.m4a")),
        )
        // Matched by name, not by the URL.
        assertThat(base).isEqualTo("Daft Punk - Get Lucky")
    }

    @Test
    fun `a song that is not in the folder has no files`() {
        val base = MeloSidecar.baseNameFor(
            track.copy(id = "other", title = "A song melo never saved"),
            rowPath = null,
            audioFiles = listOf(file("Daft Punk - Get Lucky.m4a")),
        )
        assertThat(base).isNull()
    }

    @Test
    fun `sidecar names share the song's base name`() {
        assertThat(MeloSidecar.lyricsName("Daft Punk - Get Lucky")).isEqualTo("Daft Punk - Get Lucky.lrc")
        assertThat(MeloSidecar.artworkName("Daft Punk - Get Lucky")).isEqualTo("Daft Punk - Get Lucky.jpg")
        assertThat(MeloSidecar.metaName("Daft Punk - Get Lucky")).isEqualTo("Daft Punk - Get Lucky.json")
    }
}
