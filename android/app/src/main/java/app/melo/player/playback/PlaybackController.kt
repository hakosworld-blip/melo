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
    val durationMs: Long = 0L,
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

    /**
     * Playback position is deliberately kept out of [state]. It changes several times a
     * second, while [state] only changes when the player actually does something. Keeping
     * them apart means a tick repaints one progress bar instead of recomposing the screen
     * that shows it — and because the navigation root collects [state], the whole screen
     * graph with it.
     */
    private val _position = MutableStateFlow(0L)
    val position: StateFlow<Long> = _position.asStateFlow()

    private val _buffered = MutableStateFlow(0L)
    val buffered: StateFlow<Long> = _buffered.asStateFlow()

    /**
     * Decoding every queue item back out of its URI is the expensive part of a publish,
     * and the queue only changes on real edits, so the decoded list is cached alongside
     * the URIs it was built from.
     */
    private var queuedUris: List<android.net.Uri> = emptyList()
    private var queuedTracks: List<Track> = emptyList()

    private var controller: MediaController? = null
    private var ticker: Job? = null
    private var connectRequested = false
    private var restoredThisProcess = false

    /**
     * Commands issued before the service answered.
     *
     * The bind is asynchronous and the first tap of a session almost always lands inside
     * that window. Dropping it is what reads as "the play button does nothing", so the
     * intent is held here and replayed the moment the controller arrives. Kept in order:
     * a `play` followed by an `addToQueue` has to land in that sequence.
     */
    private val pendingCommands = mutableListOf<(MediaController) -> Unit>()

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
            val bound = runCatching {
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

            if (bound.isSuccess) {
                flushPendingCommands()
            } else {
                // The bind failed, so it must be allowed again: latching connectRequested
                // here would leave the app with no controller for the rest of the process
                // and every subsequent play tap would be dropped in silence.
                connectRequested = false
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /** Runs [block] against the controller now, or holds it until the bind lands. */
    private fun withController(block: (MediaController) -> Unit) {
        val c = controller
        if (c != null) {
            block(c)
            return
        }
        pendingCommands += block
        connect()
    }

    private fun flushPendingCommands() {
        val c = controller ?: return
        if (pendingCommands.isEmpty()) return
        val queued = pendingCommands.toList()
        pendingCommands.clear()
        queued.forEach { it(c) }
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
        val uris = (0 until p.mediaItemCount).mapNotNull { i ->
            p.getMediaItemAt(i).localConfiguration?.uri
        }
        if (uris != queuedUris) {
            queuedUris = uris
            queuedTracks = uris.mapNotNull(TrackCodec::fromUri)
        }
        val currentIndex = p.currentMediaItemIndex
        val next = PlaybackState(
            current = p.currentMediaItem?.localConfiguration?.uri?.let(TrackCodec::fromUri),
            isPlaying = p.isPlaying,
            durationMs = p.duration.takeIf { it > 0 && it != C.TIME_UNSET } ?: 0L,
            buffering = p.playbackState == Player.STATE_BUFFERING,
            queue = queuedTracks,
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
        _position.value = p.currentPosition.coerceAtLeast(0L)
        _buffered.value = p.bufferedPosition.coerceAtLeast(0L)

        // The controller reports an event for every position tick, so only publish when
        // something other than the position actually moved.
        if (next != _state.value) _state.value = next
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
        if (tracks.isEmpty()) return
        withController { c ->
            val items = tracks.map(MediaItems::from)
            c.setMediaItems(items, startIndex.coerceIn(0, items.lastIndex), 0L)
            shuffle?.let { c.shuffleModeEnabled = it }
            c.prepare()
            c.play()
            publish(c)
        }
    }

    fun playNext(track: Track) {
        withController { c ->
            c.addMediaItem(MediaItems.from(track))
            val insertAt = c.currentMediaItemIndex + 1
            if (insertAt <= c.mediaItemCount - 1) {
                c.moveMediaItem(c.mediaItemCount - 1, insertAt)
            }
            if (c.mediaItemCount == 1) {
                c.prepare()
            }
        }
    }

    fun addToQueue(track: Track) {
        withController { c ->
            if (c.mediaItemCount == 0) {
                play(listOf(track))
            } else {
                c.addMediaItem(MediaItems.from(track))
            }
        }
    }

    fun addAllToQueue(tracks: List<Track>) {
        if (tracks.isEmpty()) return
        withController { c ->
            if (c.mediaItemCount == 0) {
                play(tracks)
            } else {
                c.addMediaItems(tracks.map(MediaItems::from))
            }
        }
    }

    fun toggle() {
        withController { c ->
            if (c.isPlaying) c.pause() else {
                if (c.playbackState == Player.STATE_IDLE) c.prepare()
                c.play()
            }
        }
    }

    fun playPause() = toggle()

    fun next() {
        withController { c ->
            if (c.hasNextMediaItem()) c.seekToNextMediaItem() else c.seekTo(0, 0L)
        }
    }

    fun previous() {
        withController { c ->
            if (c.currentPosition > 4_000) c.seekTo(0)
            else if (c.hasPreviousMediaItem()) c.seekToPreviousMediaItem()
        }
    }

    fun seekTo(ms: Long) {
        withController { c ->
            c.seekTo(ms.coerceAtLeast(0L))
            publish(c)
        }
    }

    fun seekToRelative(ms: Long) {
        withController { c ->
            c.seekTo((c.currentPosition + ms).coerceAtLeast(0L))
        }
    }

    fun setShuffle(enabled: Boolean) {
        withController { c ->
            c.shuffleModeEnabled = enabled
            publish(c)
        }
    }

    /** 0 off, 1 all, 2 one */
    fun setRepeat(mode: Int) {
        withController { c ->
            c.repeatMode = when (mode) {
                1 -> Player.REPEAT_MODE_ALL
                2 -> Player.REPEAT_MODE_ONE
                else -> Player.REPEAT_MODE_OFF
            }
            publish(c)
        }
    }

    fun setSpeed(speed: Float) {
        withController { c ->
            c.setPlaybackSpeed(speed)
            publish(c)
        }
    }

    fun setPitch(semitones: Float) {
        withController { c ->
            val params = c.playbackParameters
            // ExoPlayer's Sonic processor shifts pitch independently of tempo.
            c.playbackParameters = androidx.media3.common.PlaybackParameters(params.speed, semitonesToPitch(semitones))
            publish(c)
        }
    }

    private fun semitonesToPitch(semitones: Float): Float =
        Math.pow(2.0, semitones / 12.0).toFloat()

    fun playQueueIndex(index: Int) {
        withController { c ->
            if (index in 0 until c.mediaItemCount) {
                c.seekTo(index, 0L)
                c.play()
            }
        }
    }

    fun removeQueueItem(index: Int) {
        withController { c ->
            if (index in 0 until c.mediaItemCount) c.removeMediaItem(index)
        }
    }

    fun moveQueueItem(from: Int, to: Int) {
        withController { c ->
            if (from in 0 until c.mediaItemCount && to in 0 until c.mediaItemCount) {
                c.moveMediaItem(from, to)
            }
        }
    }

    fun clearQueue() {
        withController { it.clearMediaItems() }
    }

    fun stop() {
        withController { it.stop() }
    }

    suspend fun shutdown() {
        saveResumePosition()
        pendingCommands.clear()
        controller?.release()
        controller = null
    }
}
