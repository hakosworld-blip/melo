package app.melo.player.playback

import androidx.media3.common.Player
import androidx.media3.session.MediaSession
import androidx.test.core.app.ApplicationProvider
import app.melo.player.di.ServiceLocator
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * The service that actually produces sound.
 *
 * Everything upstream of here is covered separately: the codec round-trips, InnerTube
 * hands out audio URLs. This test covers the seam those all meet at — building the
 * service. If [MeloPlaybackService.onCreate] throws, no session is ever created, the
 * controller never connects, and the user sees a player UI that will not move, which is
 * exactly the reported symptom. So the service has to come up cleanly and expose a
 * working session.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MeloPlaybackServiceTest {

    /**
     * The session is private and [MediaSession.ControllerInfo] — the only way to ask
     * for it publicly — has a package-private constructor, so the field is read directly.
     */
    private fun sessionOf(service: MeloPlaybackService): MediaSession? =
        MeloPlaybackService::class.java
            .getDeclaredField("session")
            .apply { isAccessible = true }
            .get(service) as? MediaSession

    @Test
    fun `service starts and exposes a session`() {
        val service: MeloPlaybackService = Robolectric
            .buildService(MeloPlaybackService::class.java)
            .create()
            .get()

        val session = sessionOf(service)

        assertThat(session).isNotNull()
        assertThat(session!!.player).isNotNull()
        assertThat(session.player.playbackState).isEqualTo(Player.STATE_IDLE)
    }

    @Test
    fun `service survives being started and stopped`() {
        // A crash in onDestroy leaves the media session registered with the system and
        // the next bind fails, so the lifecycle has to be clean in both directions.
        Robolectric.buildService(MeloPlaybackService::class.java)
            .create()
            .destroy()

        // Nothing to assert beyond not throwing; reaching here is the assertion.
        assertThat(true).isTrue()
    }

    @Test
    fun `media items built from a track keep their metadata`() {
        // The notification and lock screen read these, so a null here is a blank
        // notification rather than an error.
        val track = app.melo.player.data.model.Track(
            id = "dQw4w9WgXcQ",
            title = "Make U Whole (GEEMIX)",
            artist = "Andronicus & GEE LEE",
            album = "Geemix",
            artwork = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        )
        val item = MediaItems.from(track)

        assertThat(item.mediaMetadata.title).isEqualTo("Make U Whole (GEEMIX)")
        assertThat(item.mediaMetadata.artist).isEqualTo("Andronicus & GEE LEE")
        assertThat(item.mediaMetadata.albumTitle).isEqualTo("Geemix")
        assertThat(item.mediaMetadata.artworkUri).isNotNull()
        assertThat(item.mediaId).isEqualTo(track.key)
    }

    @Test
    fun `notification provider uses the melo channel and icon`() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        ServiceLocator.init(context)

        // The channel id is what shows up in Android's notification settings; a stock
        // Media3 channel name there would read as a foreign app.
        assertThat(MeloNotificationProvider.CHANNEL_ID).isEqualTo("melo_playback")
        assertThat(context.getString(app.melo.player.R.string.notification_channel_playback))
            .isEqualTo("Playback")
        // The small icon is what the status bar actually draws.
        assertThat(app.melo.player.R.drawable.ic_stat_melo).isNotEqualTo(0)
    }

    @Test
    fun `deferred factory does not build the chain until first read`() {
        var built = false
        val deferred = DeferredDataSourceFactory {
            built = true
            throw IllegalStateException("should not be reached in this test")
        }

        // Constructing it must not touch the delegate — that is the whole point of the
        // class: the chain does disk work, and the service is created during launch.
        assertThat(built).isFalse()
    }
}
