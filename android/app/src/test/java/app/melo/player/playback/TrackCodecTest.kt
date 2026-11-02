package app.melo.player.playback

import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Every queue item travels as a `melo://track/<base64>` URI, and the playback service
 * decodes it back on the far side. If that round trip fails, [TrackCodec.fromUri]
 * returns null, the resolver passes the URI through untouched, and ExoPlayer tries to
 * open a `melo://` scheme it does not understand — which reads as "music won't play"
 * with no error surfaced anywhere else. So this is the load-bearing test for playback.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class TrackCodecTest {

    private fun sample() = Track(
        id = "dQw4w9WgXcQ",
        title = "Make U Whole (GEEMIX)",
        artist = "Andronicus & GEE LEE",
        album = "Geemix",
        durationMs = 240_000L,
        artwork = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        source = Source.YOUTUBE,
        explicit = true,
        streamUrl = "",
        webUrl = "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        searchQuery = "",
    )

    @Test
    fun `track survives the uri round trip`() {
        val original = sample()
        val decoded = TrackCodec.fromUri(TrackCodec.uriFor(original))

        assertThat(decoded).isNotNull()
        assertThat(decoded).isEqualTo(original)
    }

    @Test
    fun `key survives the uri round trip`() {
        // Favourites, history and downloads are all keyed off this, so a decode that
        // changes it would silently orphan the user's library.
        val original = sample()
        val decoded = TrackCodec.fromUri(TrackCodec.uriFor(original))!!

        assertThat(decoded.key).isEqualTo(original.key)
    }

    @Test
    fun `uri uses the melo scheme the resolver expects`() {
        val uri = TrackCodec.uriFor(sample())

        assertThat(uri.scheme).isEqualTo("melo")
        assertThat(uri.host).isEqualTo("track")
        assertThat(uri.lastPathSegment).isNotNull()
    }

    @Test
    fun `unicode title survives the round trip`() {
        // Base64 of UTF-8; a charset mismatch here would only bite on non-ASCII titles.
        val original = sample().copy(
            title = "Жаркий дождь — Ñoña ♪",
            artist = "Бандэрлог & Ñoña",
        )

        assertThat(TrackCodec.fromUri(TrackCodec.uriFor(original))).isEqualTo(original)
    }

    @Test
    fun `long artwork urls survive the round trip`() {
        // URLs with query strings and unicode escapes are the awkward case for a
        // path segment, so make sure the encoder is not truncating them.
        val original = sample().copy(
            artwork = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg?sqp=-oaymwEcCNACELIWBSFXyq4qpAw&rs=AOn4CLB&rs=AOn4CLB-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        )

        assertThat(TrackCodec.fromUri(TrackCodec.uriFor(original))).isEqualTo(original)
    }

    @Test
    fun `unknown scheme is rejected rather than guessed`() {
        val notOurs = android.net.Uri.parse("https://example.com/track/abc")

        assertThat(TrackCodec.fromUri(notOurs)).isNull()
    }
}
