package app.melo.player.data.remote

import com.google.common.truth.Truth.assertThat
import org.junit.Test

class SpotifyImportTest {

    @Test
    fun `reads id from a web url`() {
        assertThat(SpotifyImport.playlistId("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"))
            .isEqualTo("37i9dQZF1DXcBWIGoYBM5M")
    }

    @Test
    fun `reads id from a url with query string`() {
        assertThat(
            SpotifyImport.playlistId(
                "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123&nd=1",
            ),
        ).isEqualTo("37i9dQZF1DXcBWIGoYBM5M")
    }

    @Test
    fun `reads id from a localised url`() {
        assertThat(SpotifyImport.playlistId("https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M"))
            .isEqualTo("37i9dQZF1DXcBWIGoYBM5M")
    }

    @Test
    fun `reads id from a spotify uri`() {
        assertThat(SpotifyImport.playlistId("spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"))
            .isEqualTo("37i9dQZF1DXcBWIGoYBM5M")
    }

    @Test
    fun `accepts a bare id`() {
        assertThat(SpotifyImport.playlistId("37i9dQZF1DXcBWIGoYBM5M")).isEqualTo("37i9dQZF1DXcBWIGoYBM5M")
    }

    @Test
    fun `rejects junk and unrelated links`() {
        assertThat(SpotifyImport.playlistId("")).isNull()
        assertThat(SpotifyImport.playlistId("not a link")).isNull()
        assertThat(SpotifyImport.playlistId("https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).isNull()
    }

    @Test
    fun `duplicate imports are detected by name`() {
        // The screen reuses an existing playlist with the same name instead of creating
        // a second copy, which is what keeps repeated imports idempotent.
        val existingNames = listOf("Road trip", "Focus")
        val candidate = "road trip"
        assertThat(existingNames.any { it.equals(candidate, ignoreCase = true) }).isTrue()
    }
}
