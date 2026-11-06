package app.melo.player.playback

import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.test.core.app.ApplicationProvider
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The whole point of the app, tested end to end: turn a track into sound.
 *
 * Every other piece passes in isolation — the codec round-trips, InnerTube hands out
 * audio URLs, the service builds. What none of those prove is that the chain the player
 * actually opens (resolve the `melo://` item, route to the right host, stream the bytes)
 * delivers audio. This test opens that real chain and reads from it, so a failure here is
 * the reported "music won't play" rather than a cosmetic issue.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class AudioChainTest {

    private lateinit var service: MeloPlaybackService
    private lateinit var dataSourceFactory: DataSource.Factory

    private fun track() = Track(
        id = "dQw4w9WgXcQ",
        title = "Make U Whole (GEEMIX)",
        artist = "Andronicus & GEE LEE",
        source = Source.YOUTUBE,
        webUrl = "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    )

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        ServiceLocator.init(context)

        service = Robolectric.buildService(MeloPlaybackService::class.java)
            .create()
            .get()

        // The chain the player opens for a progressive track: host routing, then
        // just-in-time resolution of the melo:// item onto a fetchable URL. The audio cache
        // layer is left out because onCreate already holds the process-wide SimpleCache.
        val router = MeloPlaybackService::class.java
            .getDeclaredMethod("buildHostRoutingDataSourceFactory")
            .apply { isAccessible = true }
            .invoke(service) as DataSource.Factory
        dataSourceFactory = progressiveDataSourceFactory(router, track(), ServiceLocator.resolver::resolve)
    }

    @After
    fun tearDown() {
        // The session registers its id in a process-wide map, so a service that is never
        // destroyed keeps that id reserved and the next build in this JVM throws.
        runCatching {
            MeloPlaybackService::class.java
                .getDeclaredField("session")
                .apply { isAccessible = true }
                .get(service)
                ?.let { (it as androidx.media3.session.MediaSession).release() }
        }
        runCatching { service.onDestroy() }
    }

    @Test
    fun `a track uri produces audio bytes`() {
        val uri = TrackCodec.uriFor(track())
        val spec = DataSpec(uri).buildUpon().setKey(track().key).build()

        val source = dataSourceFactory.createDataSource()
        val total = try {
            source.open(spec)
            val buffer = ByteArray(16 * 1024)
            var read = 0
            var total = 0L
            while (read >= 0 && total < 64 * 1024) {
                read = source.read(buffer, 0, buffer.size)
                if (read > 0) total += read
            }
            total
        } finally {
            runCatching { source.close() }
        }

        // A silent failure returns 0 bytes or throws; real audio is tens of kilobytes
        // within the first read.
        assertThat(total).isGreaterThan(8_192L)
    }

    @Test
    fun `resolver maps the melo scheme onto a real host`() {
        val uri = TrackCodec.uriFor(track())
        val spec = DataSpec(uri).buildUpon().setKey(track().key).build()

        val source = dataSourceFactory.createDataSource()
        try {
            source.open(spec)
            // After opening, the data source reports where it actually read from —
            // proof the melo:// placeholder was swapped for a fetchable URL.
            val resolved = source.uri
            assertThat(resolved).isNotNull()
            assertThat(resolved!!.scheme).isIn(listOf("https", "http"))
            assertThat(resolved.host).doesNotContain("melo")
        } finally {
            runCatching { source.close() }
        }
    }

    @Test
    fun `unknown scheme is passed through rather than crashing the chain`() {
        // A non-melo URI must not throw out of open(); the chain treats it as-is so
        // local files and already-resolved URLs keep working.
        val source = dataSourceFactory.createDataSource()
        val spec = DataSpec(android.net.Uri.parse("file:///dev/null")).buildUpon().build()

        try {
            // open() may legitimately fail for a null device; what matters is that it
            // fails as an IOException the player can report, not as a crash.
            runCatching { source.open(spec) }
                .exceptionOrNull()
                ?.let { assertThat(it).isInstanceOf(java.io.IOException::class.java) }
        } finally {
            runCatching { source.close() }
        }
    }
}
