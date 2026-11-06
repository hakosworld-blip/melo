package app.melo.player.data.remote

import app.melo.player.data.model.ResolvedStream
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Live resolution of a real YouTube Music id.
 *
 * The rest of the playback stack is covered by unit tests with fakes, but the one part
 * that genuinely fails in the field is this: InnerTube changes its player clients, and
 * when they stop handing out direct audio URLs every track in the app reads as
 * "could not play". So this test talks to the real endpoint. If it fails, playback is
 * broken for every track regardless of what the UI does.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class YouTubeMusicResolveTest {

    @Test
    fun `resolves a real video to a streamable audio url`() = runBlocking {
        // Rick Astley — a stable, always-available, non-age-restricted video.
        val result = YouTubeMusic.resolveAudio("dQw4w9WgXcQ")

        assertThat(result).isInstanceOf(ResolvedStream.Remote::class.java)
        val remote = result as ResolvedStream.Remote

        // The resolver hands this straight to ExoPlayer, so it has to be an http(s) URL
        // pointing at something that actually carries audio.
        assertThat(remote.url).startsWith("http")
        assertThat(remote.url).doesNotContain("signatureCipher")
        assertThat(remote.url).doesNotContain("cipher=")
    }

    @Test
    fun `resolution picks an audio mime type, not video`() = runBlocking {
        // Guards the bitrate sort: a video format would sort higher and win, and the
        // player would then be asked to demux video it has no video track for.
        val result = YouTubeMusic.resolveAudio("dQw4w9WgXcQ")
        assertThat(result).isInstanceOf(ResolvedStream.Remote::class.java)

        val url = (result as ResolvedStream.Remote).url
        // googlevideo URLs do not carry the mime type, but the itag does: 251/249 opus,
        // 140/139 mp4a are audio; 18/22/137/140+video are not.
        val itag = Regex("[?&]itag=(\\d+)").find(url)?.groupValues?.get(1)
        if (itag != null) {
            assertThat(itag).isIn(listOf("139", "140", "249", "250", "251"))
        }
    }

    @Test
    fun `garbage id fails cleanly instead of throwing`() = runBlocking {
        val result = YouTubeMusic.resolveAudio("not-a-video-id")

        assertThat(result).isInstanceOf(ResolvedStream.Failure::class.java)
    }

    @Test
    fun `search returns real tracks`() = runBlocking {
        val hits = YouTubeMusic.searchSongs("daft punk", 8)

        assertThat(hits).isNotEmpty()
        // Every hit must be resolvable later, which means it needs a real video id.
        assertThat(hits.all { it.id.matches(Regex("^[\\w-]{11}$")) }).isTrue()
    }
}
