package app.melo.player.playback

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import androidx.test.core.app.ApplicationProvider
import app.melo.player.R
import com.google.common.collect.ImmutableList
import com.google.common.truth.Truth.assertThat
import java.util.UUID
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The background-playback notification.
 *
 * This is the card the user pulls down to pause, skip and go back while melo is playing in
 * the background — the thing that has to keep working even when melo is not on screen. These
 * tests build a real MediaSession over a fake player and ask our provider for the
 * notification, then assert the three controls are present, in the right order, labelled
 * correctly, that the melo small icon is used, and that the card is a MediaStyle bound to
 * the session (which is what gives Android 13+ its seek bar and timestamps).
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
@OptIn(UnstableApi::class)
class MeloNotificationProviderTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    /**
     * Minimal player reporting one loaded, playing track.
     *
     * `SimpleBasePlayer.State` and `MediaItemData` are protected, so the state has to be
     * built inside this subclass where they are in scope.
     */
    private class FakePlayer(isPlaying: Boolean) : SimpleBasePlayer(Looper.getMainLooper()) {

        private val state: State = run {
            val metadata = MediaMetadata.Builder()
                .setTitle("Make U Whole (GEEMIX)")
                .setArtist("Andronicus & GEE LEE")
                .build()
            val item = MediaItem.Builder()
                .setMediaId("track-key")
                .setUri("melo://track/track-key")
                .setMediaMetadata(metadata)
                .build()
            val itemData = MediaItemData.Builder("track-key")
                .setMediaItem(item)
                .setMediaMetadata(metadata)
                .setDurationUs(240_000_000L) // 4 minutes
                .setIsSeekable(true)
                .build()

            State.Builder()
                .setPlaylist(listOf(itemData))
                .setCurrentMediaItemIndex(0)
                .setPlaybackState(Player.STATE_READY)
                .setPlayWhenReady(isPlaying, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
                .setAvailableCommands(Player.Commands.Builder().addAllCommands().build())
                .build()
        }

        override fun getState(): State = state
    }

    private fun session(isPlaying: Boolean): MediaSession =
        MediaSession.Builder(context, FakePlayer(isPlaying))
            // media3 keeps a process-wide map of session IDs; without an explicit unique ID
            // every session we build in this test class would collide with the first one.
            .setId(UUID.randomUUID().toString())
            .build()

    /**
     * Stand-in for media3's internal action factory. It only has to hand back real
     * [NotificationCompat.Action] objects so the provider can attach them; nothing here
     * dispatches media buttons (the real session does that on a device).
     */
    private val actionFactory = object : MediaNotification.ActionFactory {
        private fun action(icon: IconCompat, label: CharSequence): NotificationCompat.Action =
            NotificationCompat.Action.Builder(
                icon,
                label,
                PendingIntent.getBroadcast(
                    context,
                    label.hashCode(),
                    Intent("app.melo.player.test.NOOP").setPackage(context.packageName),
                    PendingIntent.FLAG_IMMUTABLE,
                ),
            ).build()

        override fun createMediaAction(
            mediaSession: MediaSession,
            icon: IconCompat,
            displayName: CharSequence,
            playerCommand: Int,
        ): NotificationCompat.Action = action(icon, displayName)

        override fun createCustomAction(
            mediaSession: MediaSession,
            icon: IconCompat,
            displayName: CharSequence,
            action: String,
            extras: Bundle,
        ): NotificationCompat.Action = action(icon, displayName)

        override fun createCustomActionFromCustomCommandButton(
            mediaSession: MediaSession,
            commandButton: CommandButton,
        ): NotificationCompat.Action = action(
            IconCompat.createWithResource(context, R.drawable.ic_stat_melo),
            commandButton.displayName ?: "",
        )

        override fun createMediaActionPendingIntent(
            mediaSession: MediaSession,
            keyCode: Long,
        ): PendingIntent = PendingIntent.getBroadcast(
            context,
            keyCode.toInt(),
            Intent("app.melo.player.test.MEDIA_BUTTON").setPackage(context.packageName),
            PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun build(isPlaying: Boolean): Notification {
        val mediaSession = session(isPlaying)
        return try {
            MeloNotificationProvider(context)
                .createNotification(
                    mediaSession,
                    ImmutableList.of(),
                    actionFactory,
                    object : MediaNotification.Provider.Callback {
                        override fun onNotificationChanged(notification: MediaNotification) = Unit
                    },
                )
                .notification
        } finally {
            mediaSession.release()
        }
    }

    private fun actionTitles(n: Notification): List<String> =
        n.actions.orEmpty().map { it.title?.toString().orEmpty() }

    @Test
    fun `notification shows previous, pause and next, in that order`() {
        val notification = build(isPlaying = true)

        assertThat(actionTitles(notification))
            .containsExactly(
                context.getString(R.string.notification_control_previous),
                context.getString(R.string.notification_control_pause),
                context.getString(R.string.notification_control_next),
            )
            .inOrder()
    }

    @Test
    fun `middle control flips to play when paused`() {
        assertThat(actionTitles(build(isPlaying = false))[1])
            .isEqualTo(context.getString(R.string.notification_control_play))
    }

    @Test
    fun `notification carries the melo small icon, not a stock one`() {
        assertThat(build(isPlaying = true).icon).isEqualTo(R.drawable.ic_stat_melo)
    }

    @Test
    fun `notification reads title over artist like every other player`() {
        val notification = build(isPlaying = true)

        assertThat(notification.extras.getCharSequence(Notification.EXTRA_TITLE))
            .isEqualTo("Make U Whole (GEEMIX)")
        assertThat(notification.extras.getCharSequence(Notification.EXTRA_TEXT))
            .isEqualTo("Andronicus & GEE LEE")
    }

    @Test
    fun `notification is a MediaStyle card bound to the session`() {
        // The session token is what makes Android 13+ draw the seek bar and timestamps.
        val notification = build(isPlaying = true)

        assertThat(notification.extras.get("android.mediaSession")).isNotNull()
    }
}
