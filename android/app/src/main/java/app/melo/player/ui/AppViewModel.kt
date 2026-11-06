package app.melo.player.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.melo.player.BuildConfig
import app.melo.player.data.prefs.Settings
import app.melo.player.data.remote.AppRelease
import app.melo.player.data.remote.Updater
import app.melo.player.data.remote.YtDlp
import app.melo.player.di.ServiceLocator
import app.melo.player.playback.PlaybackController
import app.melo.player.playback.PlaybackState
import app.melo.player.ui.brand.DefaultIconId
import app.melo.player.ui.brand.LauncherIcon
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** What the settings screen knows about the yt-dlp-nightly fallback extractor. */
data class ExtractorStatus(
    val busy: Boolean = false,
    val version: String? = null,
    val error: String? = null,
)

/** What the settings screen knows about the newest release on the repository. */
data class UpdateStatus(
    val checking: Boolean = false,
    /** Non-null only when the release is genuinely newer than the running build. */
    val available: AppRelease? = null,
    /** Newest version seen, even when this build is already current. */
    val latestVersion: String? = null,
    val error: String? = null,
)

/** A day between automatic update checks. */
private const val UPDATE_CHECK_INTERVAL_MS = 24L * 60 * 60 * 1000

/** Process-wide app state: preferences plus the one playback controller. */
class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val context = app.applicationContext

    val settings: StateFlow<Settings> = ServiceLocator.settings.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, Settings())

    val playback: PlaybackController = PlaybackController(context, viewModelScope)

    /**
     * yt-dlp state is fetched on demand, never at start-up: initialising the embedded Python
     * unpacks megabytes, and the fallback is only needed when InnerTube fails.
     */
    val extractor: MutableStateFlow<ExtractorStatus> = MutableStateFlow(ExtractorStatus())

    /** Result of the last update check; the automatic one fills this silently. */
    val updates: MutableStateFlow<UpdateStatus> = MutableStateFlow(UpdateStatus())

    val playbackState: StateFlow<PlaybackState> get() = playback.state

    init {
        playback.connect()
        // Pick up anything already sitting in the melo folder: songs downloaded by an
        // earlier install, or files the user copied in themselves.
        viewModelScope.launch { runCatching { ServiceLocator.downloads.scanFolder() } }
        // Automatic update check: once a day at most, and silent. A device that is offline
        // then simply tries again next launch, because only a successful check is recorded.
        viewModelScope.launch {
            val prefs = ServiceLocator.settings.current()
            val due = System.currentTimeMillis() - prefs.lastUpdateCheckMs > UPDATE_CHECK_INTERVAL_MS
            if (prefs.autoUpdateCheck && due) checkForUpdates(silent = true)
        }
    }

    fun setThemeMode(mode: String) = apply { ServiceLocator.settings.setThemeMode(mode) }
    fun setPalette(id: String) = apply { ServiceLocator.settings.setPalette(id) }
    fun setBackgroundStyle(style: String) = apply { ServiceLocator.settings.setBackgroundStyle(style) }
    fun setBackgroundImage(uri: String) = apply { ServiceLocator.settings.setBackgroundImage(uri) }
    fun setCornerRadius(value: Int) = apply { ServiceLocator.settings.setCornerRadius(value) }
    fun setCompact(value: Boolean) = apply { ServiceLocator.settings.setCompact(value) }
    fun setLyricsBgArtwork(value: Boolean) = apply { ServiceLocator.settings.setLyricsBackgroundArtwork(value) }
    fun setBlur(value: Int) = apply { ServiceLocator.settings.setBackgroundBlur(value) }
    fun setDim(value: Int) = apply { ServiceLocator.settings.setBackgroundDim(value) }
    fun setGradient(value: Boolean) = apply { ServiceLocator.settings.setBackgroundGradient(value) }
    fun setDynamicAccent(value: Boolean) = apply { ServiceLocator.settings.setDynamicAccent(value) }

    fun setCustomAccent(value: Boolean) = apply { ServiceLocator.settings.setCustomAccent(value) }
    fun setAccentColor(argb: Int) = apply { ServiceLocator.settings.setAccentColor(argb) }

    /** Fetches the newest nightly yt-dlp build and reports how it went. */
    fun refreshExtractor() {
        if (extractor.value.busy) return
        extractor.value = extractor.value.copy(busy = true)
        viewModelScope.launch {
            val version = YtDlp.updateNightly(context) ?: YtDlp.version(context)
            extractor.value = if (version != null) {
                ExtractorStatus(version = version)
            } else {
                ExtractorStatus(error = YtDlp.lastError() ?: "check your connection")
            }
        }
    }

    /**
     * Asks GitHub for the newest release and compares it with this build. [silent] is the
     * automatic check: it never reports a failure the user did not ask about.
     */
    fun checkForUpdates(silent: Boolean = false) {
        if (updates.value.checking) return
        updates.value = updates.value.copy(checking = true, error = null)
        viewModelScope.launch {
            val release = Updater.fetchLatest()
            updates.value = when {
                release == null && silent -> UpdateStatus(
                    available = updates.value.available,
                    latestVersion = updates.value.latestVersion,
                )
                release == null -> UpdateStatus(error = "Couldn't reach GitHub")
                Updater.isNewerVersion(release.version, BuildConfig.VERSION_NAME) ->
                    UpdateStatus(available = release, latestVersion = release.version)
                else -> UpdateStatus(latestVersion = release.version)
            }
            if (release != null) {
                ServiceLocator.settings.setLastUpdateCheck(System.currentTimeMillis())
            }
        }
    }

    fun setAutoUpdateCheck(value: Boolean) = apply { ServiceLocator.settings.setAutoUpdateCheck(value) }

    /** Persists the choice, then flips the enabled launcher alias. */
    fun setAppIcon(id: String) {
        apply { ServiceLocator.settings.setAppIcon(id) }
        LauncherIcon.apply(context, id)
    }

    fun setLogo(id: String) = apply { ServiceLocator.settings.setLogo(id) }

    fun setLyricsMode(mode: String) = apply { ServiceLocator.settings.setLyricsMode(mode) }
    fun setLyricsSize(value: Int) = apply { ServiceLocator.settings.setLyricsTextSize(value) }
    fun setLyricsFont(value: String) = apply { ServiceLocator.settings.setLyricsFont(value) }
    fun setLyricsAlignCenter(value: Boolean) = apply { ServiceLocator.settings.setLyricsAlignCenter(value) }
    fun setLyricsSpacing(value: Int) = apply { ServiceLocator.settings.setLyricsLineSpacing(value) }
    fun setLyricsKaraoke(value: Boolean) = apply { ServiceLocator.settings.setLyricsKaraoke(value) }
    fun setLyricsAutoScroll(value: Boolean) = apply { ServiceLocator.settings.setLyricsAutoScroll(value) }
    fun setLyricsOffset(value: Int) = apply { ServiceLocator.settings.setLyricsOffset(value) }

    fun setShuffle(value: Boolean) {
        apply { ServiceLocator.settings.setShuffle(value) }
        playback.setShuffle(value)
    }

    fun setRepeat(mode: Int) {
        apply { ServiceLocator.settings.setRepeatMode(mode) }
        playback.setRepeat(mode)
    }

    fun setGapless(value: Boolean) = apply { ServiceLocator.settings.setGapless(value) }

    /** The service reads this itself, so no player call is needed here. */
    fun setCrossfade(seconds: Int) = apply { ServiceLocator.settings.setCrossfade(seconds) }

    fun setPlaybackSpeed(value: Float) {
        apply { ServiceLocator.settings.setPlaybackSpeed(value) }
        playback.setSpeed(value)
    }

    fun setStreamQuality(id: String) = apply { ServiceLocator.settings.setStreamQuality(id) }
    fun setMobileData(value: Boolean) = apply { ServiceLocator.settings.setMobileDataStreaming(value) }
    fun setResumeOnStart(value: Boolean) = apply { ServiceLocator.settings.setResumeOnStart(value) }
    fun setHistoryEnabled(value: Boolean) = apply { ServiceLocator.settings.setHistoryEnabled(value) }
    fun setShowExplicit(value: Boolean) = apply { ServiceLocator.settings.setShowExplicit(value) }
    fun setDownloadQuality(id: String) = apply { ServiceLocator.settings.setDownloadQuality(id) }
    fun setDownloadWifiOnly(value: Boolean) = apply { ServiceLocator.settings.setDownloadWifiOnly(value) }
    fun setCacheLimit(mb: Int) = apply { ServiceLocator.settings.setCacheLimit(mb) }
    fun setShowStatsSource(value: Boolean) = apply { ServiceLocator.settings.setShowStatsSource(value) }
    fun resetSettings() {
        apply { ServiceLocator.settings.resetToDefaults() }
        // Resetting the preferences also resets the icon, so the launcher has to follow.
        LauncherIcon.apply(context, DefaultIconId)
    }

    fun clearError() = playback.clearError()

    fun clearHistory() = apply { ServiceLocator.library.clearHistory() }

    fun clearAllDownloads() = apply { ServiceLocator.downloads.clearAll() }

    fun clearLibrary() = apply { ServiceLocator.library.clearAllLibraryData() }

    private fun apply(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }
}
