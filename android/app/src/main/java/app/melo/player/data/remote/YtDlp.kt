package app.melo.player.data.remote

import android.content.Context
import app.melo.player.data.model.ResolvedStream
import com.yausername.youtubedl_android.YoutubeDL
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.Request
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

    /** Where the last nightly check is remembered, so it survives a restart. */
    private const val PREFS = "melo_extractor"
    private const val KEY_LAST_NIGHTLY_CHECK = "last_nightly_check"

    /** Best audio the provider offers, versus the best one that stays frugal. */
    private const val FORMAT_BEST = "bestaudio[ext=m4a]/bestaudio/best"
    private const val FORMAT_FRUGAL = "bestaudio[abr<=128]/bestaudio/best"

    /**
     * One extraction attempt: how yt-dlp should present itself, and the identity the CDN will
     * see when the URL is read back.
     *
     * yt-dlp's own defaults come first. Pinning `android_vr` — the previous behaviour — made
     * extraction succeed and every returned URL answer 403, which the player could only show
     * as "nothing plays"; the pinned clients stay afterwards as fallbacks.
     */
    private data class Strategy(val extractorArgs: String?, val userAgent: String)

    private val STRATEGIES = listOf(
        Strategy(null, Api.WEB_UA),
        Strategy("youtube:player_client=android", Api.WEB_UA),
        Strategy("youtube:player_client=android_vr", Api.ANDROID_VR_UA),
    )

    private const val WATCH_URL = "https://www.youtube.com/watch?v="

    private val initLock = Mutex()

    /** Background refreshes never hold up a play request. */
    private val refreshScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile private var ready = false
    @Volatile private var failure: String? = null

    /** The last thing that went wrong, for the settings screen. */
    fun lastError(): String? = failure

    /**
     * Starts the embedded Python and the nightly refresh off the play path. Unpacking the
     * interpreter takes seconds, and doing it on the first press of play is what made playback
     * look dead on a fresh install.
     */
    fun warmUp(context: Context) {
        if (ready) return
        refreshScope.launch { ensureReady(context.applicationContext) }
    }

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
            stampNightlyCheck(app)
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

        // Each attempt only counts once the CDN has actually served audio bytes for the URL
        // it returned, with the same identity playback will use.
        for (strategy in STRATEGIES) {
            val request = YoutubeDLRequest(WATCH_URL + videoId)
            request.addOption("--no-playlist")
            request.addOption("--no-warnings")
            request.addOption("--no-check-certificates")
            request.addOption("--socket-timeout", "8")
            request.addOption("-f", if (highQuality) FORMAT_BEST else FORMAT_FRUGAL)
            strategy.extractorArgs?.let { request.addOption("--extractor-args", it) }
            // -g prints the media URL instead of downloading the file.
            request.addOption("-g")

            val response = runCatching { YoutubeDL.execute(request) }
                .onFailure { failure = describe(it) }
                .getOrNull() ?: continue

            if (response.exitCode != 0) {
                failure = response.err.lineSequence().lastOrNull { it.isNotBlank() }?.trim()
                continue
            }

            val urls = response.out.lineSequence()
                .map { it.trim() }
                .filter { it.startsWith("https://") || it.startsWith("http://") }
                .toList()

            for (url in urls) {
                if (!servesAudio(url, strategy.userAgent)) continue
                failure = null
                return@withContext ResolvedStream.Remote(
                    url,
                    hls = url.contains(".m3u8"),
                    userAgent = strategy.userAgent,
                )
            }
        }
        null
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
                // The stamp is persisted: kept in memory only, every app launch looked stale and
                // re-downloaded the whole nightly build — tens of megabytes, timed exactly when
                // the user pressed play on the one track the fast path could not resolve.
                if (System.currentTimeMillis() - lastNightlyCheck(app) > NIGHTLY_TTL_MS) {
                    // Stamp first and refresh in the background: downloading a nightly build
                    // while the user waits on a play button is what made playback look dead.
                    stampNightlyCheck(app)
                    refreshScope.launch {
                        runCatching { YoutubeDL.updateYoutubeDL(app, YoutubeDL.UpdateChannel.NIGHTLY) }
                    }
                }
                ready = true
                failure = null
            }.onFailure { failure = describe(it) }

            ready
        }
    }

    private fun lastNightlyCheck(context: Context): Long =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getLong(KEY_LAST_NIGHTLY_CHECK, 0L)

    private fun stampNightlyCheck(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putLong(KEY_LAST_NIGHTLY_CHECK, System.currentTimeMillis())
            .apply()
    }

    private fun versionOf(context: Context): String? =
        runCatching { YoutubeDL.version(context) }
            .getOrNull()
            ?.lineSequence()
            ?.firstOrNull { it.isNotBlank() }
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    /** A ranged read, so a 403 or an empty body is caught here instead of in the player. */
    private suspend fun servesAudio(url: String, userAgent: String): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            val req = Request.Builder()
                .url(url)
                .header("User-Agent", userAgent)
                .header("Range", "bytes=0-16383")
                .build()
            Api.streamingClient.newCall(req).execute().use { res ->
                if (!res.isSuccessful && res.code != 206) return@use false
                val body = res.body ?: return@use false
                val buffer = ByteArray(2048)
                body.byteStream().read(buffer) >= 512
            }
        }.getOrDefault(false)
    }

    private fun describe(error: Throwable): String =
        error.message?.takeIf { it.isNotBlank() } ?: error.javaClass.simpleName
}
