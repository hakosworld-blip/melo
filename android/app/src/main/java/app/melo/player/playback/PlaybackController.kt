package app.melo.player.playback

import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.melo.player.data.model.Track
import app.melo.player.di.ServiceLocator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class PlaybackState(
    val current: Track? = null,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val bufferedMs: Long = 0L,
    val buffering: Boolean = false,
    val queue: List<Track> = emptyList(),
    val index: Int = 0,
    val shuffle: Boolean = false,
    val repeatMode: Int = 0,
    val speed: Float = 1f,
    val connected: Boolean = false,
    val error: String? = null,
)

/**
 * The app's single handle on the playback service.
 *
 * Screens never touch ExoPlayer directly; they read [state] and call the commands
 * below, which keeps queue edits legal and keeps history/resume in one place.
 */
class PlaybackController(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow(PlaybackState())
    val state: StateFlow<PlaybackState> = _state.asStateFlow()

    private var controller: MediaController? = null
    private var ticker: Job? = null
    private var connectRequested = false
    private var restoredThisProcess = false

    private val resumePrefs: SharedPreferences =
        context.getSharedPreferences("melo_resume", Context.MODE_PRIVATE)

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) {
            publish(player)
        }

        override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) {
            mediaItem?.localConfiguration?.uri?.let(TrackCodec::fromUri)?.let { track ->
                scope.launch {
                    val settings = ServiceLocator.settings.current()
                    if (settings.historyEnabled) ServiceLocator.library.recordPlay(track)
                    resumePrefs.edit()
                        .putString("key", track.key)
                        .putLong("position", 0L)
                        .apply()
                }
            }
            publish(controller)
        }

        override fun onPlayerError(error: PlaybackException) {
            _state.value = _state.value.copy(
                error = friendlyError(error),
                isPlaying = false,
            )
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            publish(controller)
            startTicker(isPlaying)
            if (!isPlaying) saveResumePosition()
        }
    }

    fun connect() {
        if (connectRequested) return
        connectRequested = true
        val token = SessionToken(context, ComponentName(context, MeloPlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            runCatching {
                val c = future.get()
                controller = c
                c.addListener(listener)
                c.setAudioAttributes(
                    androidx.media3.common.AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .build(),
                    true,
                )
                scope.launch {
                    val settings = ServiceLocator.settings.current()
                    c.shuffleModeEnabled = settings.shuffle
                    c.repeatMode = when (settings.repeatMode) {
                        1 -> Player.REPEAT_MODE_ALL
                        2, 3 -> Player.REPEAT_MODE_ONE
                        else -> Player.REPEAT_MODE_OFF
                    }
                    c.setPlaybackSpeed(settings.playbackSpeed)
                    publish(c)
                    if (!restoredThisProcess) {
                        restoredThisProcess = true
                        maybeRestoreSession(c, settings.resumeOnStart)
                    }
                }
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /** Bring back the last track, paused, at the position it was left. */
    private suspend fun maybeRestoreSession(c: MediaController, enabled: Boolean) {
        if (!enabled) return
        if (c.mediaItemCount > 0) {
            publish(c)
            return
        }
        val last = ServiceLocator.library.lastPlayed() ?: return
        val position = resumePrefs.getLong("position", 0L).coerceAtLeast(0L)
        c.setMediaItem(MediaItems.from(last))
        c.prepare()
        c.playWhenReady = false
        if (position > 0) c.seekTo(position)
        publish(c)
    }

    private fun friendlyError(error: PlaybackException): String = when (error.errorCode) {
        PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
        PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
        -> "No connection. Downloads keep playing offline."
        PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS -> "The provider refused this stream."
        PlaybackException.ERROR_CODE_DECODING_FAILED -> "This audio format could not be decoded."
        else -> "Could not play this track."
    }

    private fun publish(player: Player?) {
        val p = player ?: return
        val items = (0 until p.mediaItemCount).mapNotNull { i ->
            p.getMediaItemAt(i).localConfiguration?.uri?.let(TrackCodec::fromUri)
        }
        val currentIndex = p.currentMediaItemIndex
        _state.value = PlaybackState(
            current = p.currentMediaItem?.localConfiguration?.uri?.let(TrackCodec::fromUri),
            isPlaying = p.isPlaying,
            positionMs = p.currentPosition.coerceAtLeast(0L),
            durationMs = p.duration.takeIf { it > 0 && it != C.TIME_UNSET } ?: 0L,
            bufferedMs = p.bufferedPosition.coerceAtLeast(0L),
            buffering = p.playbackState == Player.STATE_BUFFERING,
            queue = items,
            index = currentIndex.coerceAtLeast(0),
            shuffle = p.shuffleModeEnabled,
            repeatMode = when (p.repeatMode) {
                Player.REPEAT_MODE_ALL -> 1
                Player.REPEAT_MODE_ONE -> 2
                else -> 0
            },
            speed = p.playbackParameters.speed,
            connected = true,
            error = _state.value.error,
        )
    }

    private fun startTicker(playing: Boolean) {
        ticker?.cancel()
        if (!playing) return
        ticker = scope.launch {
            while (isActive) {
                delay(500)
                controller?.let { publish(it) }
            }
        }
    }

    private fun saveResumePosition() {
        val c = controller ?: return
        val key = _state.value.current?.key ?: return
        resumePrefs.edit()
            .putString("key", key)
            .putLong("position", c.currentPosition)
            .apply()
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }

    /* ---------------------------- commands ---------------------------- */

    fun play(tracks: List<Track>, startIndex: Int = 0, shuffle: Boolean? = null) {
        val c = controller ?: return
        if (tracks.isEmpty()) return
        val items = tracks.map(MediaItems::from)
        c.setMediaItems(items, startIndex.coerceIn(0, items.lastIndex), 0L)
        shuffle?.let { c.shuffleModeEnabled = it }
        c.prepare()
        c.play()
        publish(c)
    }

    fun playNext(track: Track) {
        val c = controller ?: return
        c.addMediaItem(MediaItems.from(track))
        val insertAt = c.currentMediaItemIndex + 1
        if (insertAt <= c.mediaItemCount - 1) {
            c.moveMediaItem(c.mediaItemCount - 1, insertAt)
        }
        if (c.mediaItemCount == 1) {
            c.prepare()
        }
    }

    fun addToQueue(track: Track) {
        val c = controller ?: return
        if (c.mediaItemCount == 0) {
            play(listOf(track))
            return
        }
        c.addMediaItem(MediaItems.from(track))
    }

    fun addAllToQueue(tracks: List<Track>) {
        val c = controller ?: return
        if (tracks.isEmpty()) return
        if (c.mediaItemCount == 0) {
            play(tracks)
            return
        }
        c.addMediaItems(tracks.map(MediaItems::from))
    }

    fun toggle() {
        val c = controller ?: return
        if (c.isPlaying) c.pause() else {
            if (c.playbackState == Player.STATE_IDLE) c.prepare()
            c.play()
        }
    }

    fun playPause() = toggle()

    fun next() {
        controller?.let {
            if (it.hasNextMediaItem()) it.seekToNextMediaItem() else it.seekTo(0, 0L)
        }
    }

    fun previous() {
        val c = controller ?: return
        if (c.currentPosition > 4_000) c.seekTo(0) else if (c.hasPreviousMediaItem()) c.seekToPreviousMediaItem()
    }

    fun seekTo(ms: Long) {
        controller?.seekTo(ms.coerceAtLeast(0L))
        publish(controller)
    }

    fun seekToRelative(ms: Long) {
        val c = controller ?: return
        c.seekTo((c.currentPosition + ms).coerceAtLeast(0L))
    }

    fun setShuffle(enabled: Boolean) {
        controller?.shuffleModeEnabled = enabled
        publish(controller)
    }

    /** 0 off, 1 all, 2 one */
    fun setRepeat(mode: Int) {
        controller?.repeatMode = when (mode) {
            1 -> Player.REPEAT_MODE_ALL
            2 -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
        publish(controller)
    }

    fun setSpeed(speed: Float) {
        controller?.setPlaybackSpeed(speed)
        publish(controller)
    }

    fun setPitch(semitones: Float) {
        val c = controller ?: return
        val params = c.playbackParameters
        // ExoPlayer's Sonic processor shifts pitch independently of tempo.
        c.playbackParameters = androidx.media3.common.PlaybackParameters(params.speed, semitonesToPitch(semitones))
        publish(c)
    }

    private fun semitonesToPitch(semitones: Float): Float =
        Math.pow(2.0, semitones / 12.0).toFloat()

    fun playQueueIndex(index: Int) {
        val c = controller ?: return
        if (index in 0 until c.mediaItemCount) {
            c.seekTo(index, 0L)
            c.play()
        }
    }

    fun removeQueueItem(index: Int) {
        val c = controller ?: return
        if (index in 0 until c.mediaItemCount) c.removeMediaItem(index)
    }

    fun moveQueueItem(from: Int, to: Int) {
        val c = controller ?: return
        if (from in 0 until c.mediaItemCount && to in 0 until c.mediaItemCount) {
            c.moveMediaItem(from, to)
        }
    }

    fun clearQueue() {
        controller?.clearMediaItems()
    }

    fun stop() {
        controller?.stop()
    }

    suspend fun shutdown() {
        saveResumePosition()
        controller?.release()
        controller = null
    }
}
