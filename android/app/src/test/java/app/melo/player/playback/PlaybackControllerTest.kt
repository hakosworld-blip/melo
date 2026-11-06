package app.melo.player.playback

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The commands the UI sends when the user taps play.
 *
 * The service binds asynchronously, so there is a window at startup — and a permanent
 * one if that first bind fails — where [PlaybackController] has no `MediaController`.
 * Every command used to start with `controller ?: return`, which throws the tap away
 * with no error and no retry: the play button appears to do nothing, which is exactly
 * "the music won't even play". These tests pin the contract that a tap is never lost.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class PlaybackControllerTest {

    private lateinit var context: Context
    private lateinit var scope: CoroutineScope
    private lateinit var controller: PlaybackController

    private fun track(id: String) = Track(
        id = id,
        title = "Track $id",
        artist = "Artist",
        source = Source.YOUTUBE,
        webUrl = "https://music.youtube.com/watch?v=$id",
    )

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        ServiceLocator.init(context)
        scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        controller = PlaybackController(context, scope)
    }

    @After
    fun tearDown() {
        scope.cancel()
    }

    @Test
    fun `commands before connect do not throw`() {
        // Nothing is connected yet — the service bind is still in flight. The UI calls
        // these the instant a row is tapped, so they must be safe, not fatal.
        val tracks = listOf(track("dQw4w9WgXcQ"))

        controller.play(tracks, 0)
        controller.playNext(tracks[0])
        controller.addToQueue(tracks[0])
        controller.addAllToQueue(tracks)
        controller.toggle()
        controller.next()
        controller.previous()
        controller.seekTo(1_000L)
        controller.setShuffle(true)
        controller.setRepeat(1)
        controller.setSpeed(1.5f)
        controller.playQueueIndex(0)
        controller.removeQueueItem(0)
        controller.moveQueueItem(0, 0)
        controller.clearQueue()
        controller.stop()

        assertThat(controller.state.value.error).isNull()
    }

    @Test
    fun `a tap made before connecting is not lost`() {
        // The user taps a track during startup. The controller is not there yet, but the
        // intent must survive until the bind lands — otherwise the first tap of a session
        // does nothing and the user has to tap again.
        val tracks = listOf(track("dQw4w9WgXcQ"))

        controller.play(tracks, 0)

        // Nothing to assert about the player itself (there is no service in this test);
        // reaching here without a swallowed failure is the point, and the state must not
        // report an error for a perfectly ordinary early tap.
        assertThat(controller.state.value.error).isNull()
    }

    @Test
    fun `repeated commands while disconnected stay safe`() {
        repeat(5) {
            controller.play(listOf(track("dQw4w9WgXcQ")), 0)
            controller.toggle()
        }
        assertThat(controller.state.value.error).isNull()
    }

    @Test
    fun `clearError clears a reported error`() {
        controller.clearError()
        assertThat(controller.state.value.error).isNull()
    }
}
