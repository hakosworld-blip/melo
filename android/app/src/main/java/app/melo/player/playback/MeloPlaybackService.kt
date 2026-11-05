package app.melo.player.playback

import android.app.PendingIntent
import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import app.melo.player.MainActivity
import app.melo.player.data.model.ResolvedStream
import app.melo.player.data.remote.Api
import app.melo.player.data.local.LowSpaceNotifier
import app.melo.player.data.local.StorageDetector
import app.melo.player.di.ServiceLocator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.IOException

/**
 * Foreground playback service.
 *
 * Media3 owns the notification, the lock-screen controls, audio focus, headphone
 * unplug handling and the media button receiver, so playback keeps running when the
 * activity is destroyed, the screen is off or another app is in front. There is
 * exactly one ExoPlayer instance per process.
 */
@OptIn(UnstableApi::class)
class MeloPlaybackService : MediaSessionService() {

    private var player: ExoPlayer? = null
    private var session: MediaSession? = null

    /** Built on the playback thread, released from the main thread. */
    @Volatile private var audioCache: SimpleCache? = null

    /**
     * Building the source chain opens the audio cache (a SQLite-backed file store) and reads
     * the user's cache size from DataStore. Both are disk work, and this service is created
     * while the app is still starting — the controller binds to it during launch — so the
     * chain is built on first read (a playback thread) instead of in onCreate.
     */
    private val dataSourceFactory: DataSource.Factory by lazy(LazyThreadSafetyMode.SYNCHRONIZED) {
        buildDataSourceFactory()
    }

    /** Polls free space for the low-space alert; cancelled with the service. */
    private var lowSpaceJob: Job? = null

    /** Latest boundary settings, so the ramp loop does not read DataStore ten times a second. */
    @Volatile private var crossfadeSeconds = 0
    @Volatile private var gaplessEnabled = true

    /** Drives the volume ramp between tracks; cancelled with the service. */
    private var fadeJob: Job? = null

    /**
     * The ramp writes to the player, and ExoPlayer may only be touched from the thread that
     * created it, so this scope is pinned to the main thread rather than a background one.
     */
    private val rampScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
        live = this

        // Swap Media3's stock notification for melo's: melo small icon, "Playback"
        // channel, and a compact row that is always previous / play-pause / next.
        setMediaNotificationProvider(MeloNotificationProvider(this))

        // Watch free space while the service lives: once at start, then every minute, so the
        // alert appears when the device runs out mid-session instead of only at launch.
        lowSpaceJob = ServiceLocator.lifecycleScope?.launch {
            while (true) {
                val thresholdMb = ServiceLocator.settings.settings.first().storageLowSpaceThresholdMb
                val free = StorageDetector.freeBytes(this@MeloPlaybackService)
                LowSpaceNotifier.refresh(this@MeloPlaybackService, free, thresholdMb)
                delay(60_000L)
            }
        }


        // Fade settings follow the user's changes for as long as the service lives.
        ServiceLocator.lifecycleScope?.launch {
            ServiceLocator.settings.settings.collect { s ->
                crossfadeSeconds = s.crossfadeSeconds
                gaplessEnabled = s.gapless
            }
        }

        // The ramp writes to the player, which is only safe on the thread that built it, so it
        // runs on the main dispatcher rather than the default one.
        fadeJob = rampScope.launch {
            while (isActive) {
                applyVolumeRamp()
                delay(RAMP_TICK_MS)
            }
        }

        val mediaSourceFactory = DefaultMediaSourceFactory(
            DeferredDataSourceFactory { dataSourceFactory },
        )
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                /* minBufferMs = */ 30_000,
                /* maxBufferMs = */ 120_000,
                /* bufferForPlaybackMs = */ 1_500,
                /* bufferForPlaybackAfterRebufferMs = */ 3_000,
            )
            .build()

        val exo = ExoPlayer.Builder(this)
            .setMediaSourceFactory(mediaSourceFactory)
            .setLoadControl(loadControl)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()

        exo.repeatMode = Player.REPEAT_MODE_OFF

        val sessionActivity = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        session = MediaSession.Builder(this, exo)
            .setSessionActivity(sessionActivity)
            .setCallback(MeloSessionCallback())
            .build()

        player = exo
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

    /**
     * Keep playing when the user swipes the app away, unless nothing is playing —
     * then let the service go so the notification does not linger.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        val exo = player
        if (exo == null || !exo.playWhenReady || exo.mediaItemCount == 0) {
            stopSelf()
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        session?.run {
            player.release()
            release()
        }
        session = null
        player = null
        audioCache?.release()
        audioCache = null
        live = null
        lowSpaceJob?.cancel()
        fadeJob?.cancel()
        rampScope.cancel()
        LowSpaceNotifier.clear(this)
        super.onDestroy()
    }

    /**
     * Applies the boundary envelope: a fade down over the end of a track and a fade up over
     * the start of the next.
     *
     * The envelope is flat when crossfade is off and gapless is on, which leaves the boundary
     * to ExoPlayer's own gapless handling. Turning gapless off inserts a short dip instead, so
     * consecutive tracks are heard as separate songs.
     */
    private fun applyVolumeRamp() {
        val exo = player ?: return
        val fadeMs = when {
            crossfadeSeconds > 0 -> crossfadeSeconds * 1_000L
            !gaplessEnabled -> GAP_DIP_MS
            else -> 0L
        }
        val duration = exo.duration
        val target = if (!exo.isPlaying || duration <= 0L || duration == C.TIME_UNSET) {
            // Paused, live or not resolved yet: never leave the player stuck at low volume.
            1f
        } else {
            FadeEnvelope.volume(exo.currentPosition, duration, fadeMs)
        }
        if (exo.volume != target) exo.volume = target
    }

    /**
     * Empties the streaming cache through [SimpleCache]. Deleting its files behind its back
     * would leave the index pointing at data that is gone, so this is the only safe way in.
     * Returns false when no cache is open.
     */
    private fun evictCache(): Boolean = runCatching {
        val cache = audioCache ?: return false
        cache.keys.toList().forEach { cache.removeResource(it) }
        true
    }.getOrDefault(false)

    companion object {
        /**
         * The running service, so the storage screen can report and clear the audio cache.
         * Media3 owns that cache; a second SimpleCache on the same directory would corrupt it.
         */
        @Volatile private var live: MeloPlaybackService? = null

        /** The deliberate dip between tracks when gapless playback is turned off. */
        private const val GAP_DIP_MS = 350L

        /** Ten checks a second sounds smooth and costs almost nothing. */
        private const val RAMP_TICK_MS = 100L

        fun clearAudioCache(): Boolean = live?.evictCache() ?: false
    }

    private inner class MeloSessionCallback : MediaSession.Callback {
        override fun onPlaybackResumption(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): com.google.common.util.concurrent.ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            // Hand the session the last thing the user played so headset/Bluetooth
            // "resume" works after the process was killed.
            val future = com.google.common.util.concurrent.SettableFuture
                .create<MediaSession.MediaItemsWithStartPosition>()
            Thread {
                runCatching {
                    val settings = runBlocking { ServiceLocator.settings.current() }
                    val last = runBlocking { ServiceLocator.library.lastPlayed() }
                    if (!settings.resumeOnStart || last == null) {
                        future.set(
                            MediaSession.MediaItemsWithStartPosition(emptyList(), 0, 0L),
                        )
                    } else {
                        future.set(
                            MediaSession.MediaItemsWithStartPosition(
                                listOf(MediaItems.from(last)),
                                0,
                                0L,
                            ),
                        )
                    }
                }.onFailure {
                    future.set(MediaSession.MediaItemsWithStartPosition(emptyList(), 0, 0L))
                }
            }.start()
            return future
        }
    }

    /**
     * Cache -> (resolve) -> HTTP/File.
     *
     * The resolving layer is what turns a `melo://track/…` media item into a real
     * stream URL at play time, so the UI never has to hold expiring URLs and the
     * cached copy is keyed by track rather than by signature.
     */
    private fun buildDataSourceFactory(): DataSource.Factory {
        val cacheDir = File(cacheDir, "audio")
        val limitMb = runCatching { runBlocking { ServiceLocator.settings.current().cacheLimitMb } }
            .getOrDefault(512)
        val cache = SimpleCache(
            cacheDir,
            LeastRecentlyUsedCacheEvictor(limitMb.toLong() * 1024 * 1024),
            StandaloneDatabaseProvider(this),
        )
        audioCache = cache

        val googleHttp = OkHttpDataSource.Factory(Api.streamingClient)
            .setDefaultRequestProperties(mapOf("User-Agent" to Api.ANDROID_VR_UA))
        val otherHttp = OkHttpDataSource.Factory(Api.streamingClient)
            .setDefaultRequestProperties(mapOf("User-Agent" to Api.WEB_UA))
        val fileFactory = DefaultDataSource.Factory(this)

        val router = HostRoutingDataSource.Factory(googleHttp, otherHttp, fileFactory)

        val cacheFactory = CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(router)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

        val resolver = ResolvingDataSource.Resolver { dataSpec ->
            val track = TrackCodec.fromUri(dataSpec.uri)
            if (track == null) {
                dataSpec
            } else {
                when (val resolved = runBlocking { ServiceLocator.resolver.resolve(track) }) {
                    is ResolvedStream.Remote ->
                        dataSpec.withUri(android.net.Uri.parse(resolved.url)).buildUpon()
                            .setKey(track.key).build()
                    is ResolvedStream.Local ->
                        // A plain file path below Android 10, a content URI above it.
                        dataSpec.withUri(android.net.Uri.parse(resolved.ref)).buildUpon()
                            .setKey(track.key).build()
                    is ResolvedStream.Failure ->
                        throw IOException(resolved.message)
                }
            }
        }
        return ResolvingDataSource.Factory(cacheFactory, resolver)
    }
}

/**
 * Defers building the real source chain until the first read, which happens on a playback
 * thread rather than while the service is being created on the main thread.
 */
@OptIn(UnstableApi::class)
class DeferredDataSourceFactory(
    private val delegate: () -> DataSource.Factory,
) : DataSource.Factory {
    override fun createDataSource(): DataSource = delegate().createDataSource()
}

/**
 * Routes each request to the right upstream: Google's CDN needs the client identity
 * the stream URL was issued to, everything else is a normal web request, and local
 * downloads are plain files.
 */
@OptIn(UnstableApi::class)
class HostRoutingDataSource private constructor(
    private val google: DataSource.Factory,
    private val web: DataSource.Factory,
    private val files: DataSource.Factory,
) : DataSource {

    private var delegate: DataSource? = null
    private var transferListener: androidx.media3.datasource.TransferListener? = null

    class Factory(
        private val google: DataSource.Factory,
        private val web: DataSource.Factory,
        private val files: DataSource.Factory,
    ) : DataSource.Factory {
        override fun createDataSource(): DataSource = HostRoutingDataSource(google, web, files)
    }

    override fun open(dataSpec: DataSpec): Long {
        val host = dataSpec.uri.host.orEmpty()
        val scheme = dataSpec.uri.scheme.orEmpty()
        val chosen = when {
            scheme == "file" || scheme == "content" -> files
            host.contains("googlevideo") || host.contains("youtube") || host.contains("ytimg") -> google
            else -> web
        }
        val source = chosen.createDataSource()
        transferListener?.let(source::addTransferListener)
        delegate = source
        return source.open(dataSpec)
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
        delegate?.read(buffer, offset, length) ?: -1

    override fun addTransferListener(transferListener: androidx.media3.datasource.TransferListener) {
        this.transferListener = transferListener
        delegate?.addTransferListener(transferListener)
    }

    override fun getUri(): android.net.Uri? = delegate?.uri

    override fun close() {
        delegate?.close()
        delegate = null
    }
}

/** Builds the MediaItem for a track, keeping metadata for the notification and lock screen. */
object MediaItems {
    @OptIn(UnstableApi::class)
    fun from(track: app.melo.player.data.model.Track): androidx.media3.common.MediaItem {
        val metadata = androidx.media3.common.MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist)
            .setAlbumTitle(track.album.takeIf { it.isNotBlank() })
            .setArtworkUri(track.artwork.takeIf { it.isNotBlank() }?.let { android.net.Uri.parse(it) })
            .setIsBrowsable(false)
            .setIsPlayable(true)
            .build()
        return androidx.media3.common.MediaItem.Builder()
            .setUri(TrackCodec.uriFor(track))
            .setMediaId(track.key)
            .setMediaMetadata(metadata)
            .build()
    }

    fun tracks(items: List<androidx.media3.common.MediaItem>): List<app.melo.player.data.model.Track> =
        items.mapNotNull { item -> item.localConfiguration?.uri?.let(TrackCodec::fromUri) }
}

