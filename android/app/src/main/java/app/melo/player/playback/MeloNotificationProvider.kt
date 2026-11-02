package app.melo.player.playback

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import app.melo.player.R
import com.google.common.collect.ImmutableList

/**
 * The media notification shown while melo plays in the background.
 *
 * Media3 already ships a very good notification (artwork, title, artist, a MediaStyle
 * compact row and a seek bar on Android 13+). This provider keeps all of that and makes
 * three deliberate changes so the result matches what melo wants, and matches the big
 * music apps' layout:
 *
 *  1. A melo small icon instead of Media3's default triangle, and a "Playback" channel
 *     instead of the generic default one, so the notification reads as melo.
 *  2. Exactly three controls — previous, play/pause, next — always present and always in
 *     that order in the compact row. Media3's default drops "previous" when the player
 *     reports it unavailable (for example a single-item queue) and can shuffle the order,
 *     which makes the row jump around while the user is reaching for it.
 *  3. The artist stays as the secondary line, so the notification reads
 *     "Title" / "Artist" like every other player.
 *
 * The seek bar and timestamps come from MediaStyle, driven by the session's playback
 * state, so they appear for free on Android 13+.
 */
@OptIn(UnstableApi::class)
class MeloNotificationProvider(context: Context) : DefaultMediaNotificationProvider(
    context,
    { DefaultMediaNotificationProvider.DEFAULT_NOTIFICATION_ID },
    CHANNEL_ID,
    R.string.notification_channel_playback,
) {

    private val appContext = context.applicationContext

    init {
        setSmallIcon(R.drawable.ic_stat_melo)
    }

    /**
     * Forces the compact row to previous / play-pause / next, in that order.
     *
     * Each button carries a `COMPACT_VIEW_INDEX` extra, which Media3 reads to decide which
     * actions show when the notification is collapsed. The play/pause button is always
     * present; previous and next are always present too, so the three controls never move.
     */
    override fun getMediaButtons(
        session: MediaSession,
        availableCommands: Player.Commands,
        customLayout: ImmutableList<CommandButton>,
        showPlayButtonIfPlaybackIsSuppressed: Boolean,
    ): ImmutableList<CommandButton> {
        val showPlay = androidx.media3.common.util.Util.shouldShowPlayButton(
            session.player,
            showPlayButtonIfPlaybackIsSuppressed,
        )

        return ImmutableList.of(
            compactButton(
                icon = CommandButton.ICON_PREVIOUS,
                playerCommand = Player.COMMAND_SEEK_TO_PREVIOUS,
                compactIndex = 0,
                label = appContext.getString(R.string.notification_control_previous),
            ),
            compactButton(
                icon = if (showPlay) CommandButton.ICON_PLAY else CommandButton.ICON_PAUSE,
                playerCommand = Player.COMMAND_PLAY_PAUSE,
                compactIndex = 1,
                label = appContext.getString(
                    if (showPlay) R.string.notification_control_play else R.string.notification_control_pause,
                ),
            ),
            compactButton(
                icon = CommandButton.ICON_NEXT,
                playerCommand = Player.COMMAND_SEEK_TO_NEXT,
                compactIndex = 2,
                label = appContext.getString(R.string.notification_control_next),
            ),
        )
    }

    /** Secondary line is the artist, so the notification reads "Title" / "Artist". */
    override fun getNotificationContentText(metadata: MediaMetadata): CharSequence? =
        metadata.artist ?: metadata.albumTitle

    private fun compactButton(
        icon: Int,
        playerCommand: Int,
        compactIndex: Int,
        label: CharSequence,
    ): CommandButton = CommandButton.Builder(icon)
        .setPlayerCommand(playerCommand)
        .setDisplayName(label)
        .setExtras(
            android.os.Bundle().apply {
                putInt(DefaultMediaNotificationProvider.COMMAND_KEY_COMPACT_VIEW_INDEX, compactIndex)
            },
        )
        .build()

    companion object {
        const val CHANNEL_ID = "melo_playback"
    }
}
