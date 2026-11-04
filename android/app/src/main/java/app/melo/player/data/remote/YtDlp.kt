package app.melo.player.data.remote

import android.content.Context
import app.melo.player.data.model.ResolvedStream
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * yt-dlp-nightly extraction.
 *
 * InnerTube answers most requests, but it regularly hands back no direct media URL at all:
 * age-restricted uploads, videos that need a freshly minted visitor token, and formats the
 * provider has only just started serving. Those are exactly the cases upstream yt-dlp fixes
 * within hours of them appearing, so melo keeps the nightly extractor and falls back to it
 * whenever the fast path returns nothing.
 *
 * The extractor itself is not in the APK: youtubedl-android ships an embedded CPython, and
 * [ensureReady] refreshes the yt-dlp build from the nightly channel at most once a day. Every
 * entry point above hops to [Dispatchers.IO] first, because initialising Python unpacks
 * megabytes and running a extractor is a blocking process call.
 */
object YtDlp {

    /** How long a downloaded nightly build counts as fresh before it is refreshed. */
    private const val NIGHTLY_TTL_MS = 24 * 60 * 60 * 1000L

    /** Best audio the provider offers, versus the best one that stays frugal. */
    private const val FORMAT_BEST = "bestaudio/best"
    private const val FORMAT_FRUGAL = "bestaudio[abr<=128]/bestaudio/best"

    private const val WATCH_URL = "https://www.youtube.com/watch?v="

    private val initLock = Mutex()

    @Volatile private var ready = false
    @Volatile private var lastNightlyCheck = 0L
    @Volatile private var failure: String? = null

    /** The last thing that went wrong, for the settings screen. */
    fun lastError(): String? = failure

    /** Version of the extractor currently installed, or null when it is not usable yet. */
    suspend fun version(context: Context): String? = withContext(Dispatchers.IO) {
        if (!ensureReady(context)) return@withContext null
        versionOf(context)
    }

    /**
     * Downloads the newest nightly build and returns its version. Called from the settings
     * screen, so it may take a few seconds and needs a connection.
     */
    suspend fun updateNightly(context: Context): String? = withContext(Dispatchers.IO) {
        runCatching {
            val app = context.applicationContext
            YoutubeDL.init(app)
            YoutubeDL.updateYoutubeDL(app, YoutubeDL.UpdateChannel.NIGHTLY)
            lastNightlyCheck = System.currentTimeMillis()
            ready = true
            failure = null
            versionOf(app)
        }.onFailure { failure = describe(it) }.getOrNull()
    }

    /**
     * Resolves a playable audio URL for [videoId], or null when yt-dlp cannot help.
     * [highQuality] maps onto the same split the InnerTube path uses: the top audio format,
     * or the best one at or under 128 kbps.
     */
    suspend fun resolveAudio(
        context: Context,
        videoId: String,
        highQuality: Boolean,
    ): ResolvedStream.Remote? = withContext(Dispatchers.IO) {
        if (videoId.isBlank()) return@withContext null
        if (!ensureReady(context)) return@withContext null

        val request = YoutubeDLRequest(WATCH_URL + videoId)
        request.addOption("--no-playlist")
        request.addOption("--no-warnings")
        request.addOption("-f", if (highQuality) FORMAT_BEST else FORMAT_FRUGAL)
        // -g prints the media URL instead of downloading the file.
        request.addOption("-g")

        val response = runCatching { YoutubeDL.execute(request) }
            .onFailure { failure = describe(it) }
            .getOrNull() ?: return@withContext null

        if (response.exitCode != 0) {
            failure = response.err.lineSequence().lastOrNull { it.isNotBlank() }?.trim()
            return@withContext null
        }

        val url = response.out.lineSequence()
            .map { it.trim() }
            .firstOrNull { it.startsWith("https://") || it.startsWith("http://") }
            ?: return@withContext null

        ResolvedStream.Remote(url, hls = url.contains(".m3u8"))
    }

    /**
     * Initialises the embedded Python once per process and keeps the extractor on the nightly
     * channel. Refreshing is best effort: offline, rate limited or a failed download all fall
     * back to the build that is already installed rather than breaking playback.
     */
    private suspend fun ensureReady(context: Context): Boolean {
        if (ready) return true
        return initLock.withLock {
            if (ready) return@withLock true

            val app = context.applicationContext
            runCatching {
                YoutubeDL.init(app)
                if (System.currentTimeMillis() - lastNightlyCheck > NIGHTLY_TTL_MS) {
                    runCatching { YoutubeDL.updateYoutubeDL(app, YoutubeDL.UpdateChannel.NIGHTLY) }
                    lastNightlyCheck = System.currentTimeMillis()
                }
                ready = true
                failure = null
            }.onFailure { failure = describe(it) }

            ready
        }
    }

    private fun versionOf(context: Context): String? =
        runCatching { YoutubeDL.version(context) }
            .getOrNull()
            ?.lineSequence()
            ?.firstOrNull { it.isNotBlank() }
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    private fun describe(error: Throwable): String =
        error.message?.takeIf { it.isNotBlank() } ?: error.javaClass.simpleName
}
