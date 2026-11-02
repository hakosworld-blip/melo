package app.melo.player.data.local

import app.melo.player.data.model.Source
import com.google.common.truth.Truth.assertThat
import org.junit.Test

class MeloMetaTest {

    private val meta = MeloMeta(
        trackKey = "youtube:abc123",
        title = "Get Lucky",
        artist = "Daft Punk",
        album = "Random Access Memories",
        durationMs = 369_000,
        explicit = false,
        source = "youtube",
        providerId = "abc123",
        webUrl = "https://music.youtube.com/watch?v=abc123",
        artworkUrl = "https://img.example/cover.jpg",
        quality = "high",
        downloadedAt = 1_700_000_000_000,
        lyricsSource = "lrclib",
        lyricsSynced = true,
        lyricsWordTimings = false,
        audioFile = "Daft Punk - Get Lucky.m4a",
        artworkFile = "Daft Punk - Get Lucky.jpg",
        lyricsFile = "Daft Punk - Get Lucky.lrc",
    )

    @Test
    fun `a sidecar survives a round trip`() {
        assertThat(MeloMetaCodec.decode(MeloMetaCodec.encode(meta))).isEqualTo(meta)
    }

    @Test
    fun `a sidecar keeps the artist, the album and the files it points at`() {
        val decoded = MeloMetaCodec.decode(MeloMetaCodec.encode(meta))!!
        assertThat(decoded.artist).isEqualTo("Daft Punk")
        assertThat(decoded.album).isEqualTo("Random Access Memories")
        assertThat(decoded.audioFile).isEqualTo("Daft Punk - Get Lucky.m4a")
        assertThat(decoded.artworkFile).isEqualTo("Daft Punk - Get Lucky.jpg")
        assertThat(decoded.lyricsFile).isEqualTo("Daft Punk - Get Lucky.lrc")
        assertThat(decoded.lyricsSynced).isTrue()
    }

    @Test
    fun `unknown keys and junk are survivable`() {
        assertThat(MeloMetaCodec.decode("""{"schema":9,"somethingNew":true,"title":"T"}""")?.title)
            .isEqualTo("T")
        assertThat(MeloMetaCodec.decode("not json at all")).isNull()
        assertThat(MeloMetaCodec.decode("")).isNull()
    }

    @Test
    fun `a downloaded song is rebuilt with the same identity`() {
        val track = meta.toTrack(artworkRef = null)
        assertThat(track.key).isEqualTo("youtube:abc123")
        assertThat(track.source).isEqualTo(Source.YOUTUBE)
        assertThat(track.title).isEqualTo("Get Lucky")
        assertThat(track.artwork).isEqualTo("https://img.example/cover.jpg")
    }

    @Test
    fun `the cover in the folder wins over the remote one`() {
        val track = meta.toTrack(artworkRef = "content://media/external/file/12")
        assertThat(track.artwork).isEqualTo("content://media/external/file/12")
    }

    @Test
    fun `a file with no sidecar still makes a playable track`() {
        val track = MeloMeta().toTrack(artworkRef = "file:///melo/cover.jpg")
        assertThat(track.source).isEqualTo(Source.LOCAL)
        assertThat(track.artist).isEqualTo("Unknown artist")
        assertThat(track.artwork).isEqualTo("file:///melo/cover.jpg")
        assertThat(track.key).isNotEqualTo("")
    }
}
