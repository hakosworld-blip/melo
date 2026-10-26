package app.melo.player.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.melo.player.data.prefs.Settings
import app.melo.player.di.ServiceLocator
import app.melo.player.playback.PlaybackController
import app.melo.player.playback.PlaybackState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Process-wide app state: preferences plus the one playback controller. */
class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val context = app.applicationContext

    val settings: StateFlow<Settings> = ServiceLocator.settings.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, Settings())

    val playback: PlaybackController = PlaybackController(context, viewModelScope)

    val playbackState: StateFlow<PlaybackState> get() = playback.state

    init {
        playback.connect()
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
    fun resetSettings() = apply { ServiceLocator.settings.resetToDefaults() }

    fun clearError() = playback.clearError()

    fun clearHistory() = apply { ServiceLocator.library.clearHistory() }

    fun clearAllDownloads() = apply { ServiceLocator.downloads.clearAll() }

    fun clearLibrary() = apply { ServiceLocator.library.clearAllLibraryData() }

    private fun apply(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }
}
