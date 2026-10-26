package app.melo.player.data.prefs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.melo.player.data.lyrics.LyricsMode
import app.melo.player.data.model.StreamQuality
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * Every preference below is read by real UI or playback code. Nothing here is
 * decorative: if a setting exists it changes behaviour.
 */
data class Settings(
    // appearance
    val themeMode: String = "dark",
    val paletteId: String = "amber",
    val backgroundStyle: String = "gradient", // solid | gradient | artwork
    val backgroundImageUri: String = "",
    val cornerRadius: Int = 20,
    val compact: Boolean = false,
    val lyricsBackgroundArtwork: Boolean = true,
    val backgroundBlur: Int = 55,
    val backgroundDim: Int = 45,
    val backgroundGradient: Boolean = true,
    val dynamicAccent: Boolean = true,
    // lyrics
    val lyricsMode: String = LyricsMode.LINE.id,
    val lyricsTextSize: Int = 30,
    val lyricsFont: String = "sans",
    val lyricsAlignCenter: Boolean = true,
    val lyricsLineSpacing: Int = 14,
    val lyricsWordKaraoke: Boolean = true,
    val lyricsAutoScroll: Boolean = true,
    val lyricsOffsetMs: Int = 0,
    // playback
    val shuffle: Boolean = false,
    val repeatMode: Int = 0, // 0 off, 1 all, 2 one
    val crossfadeSeconds: Int = 0,
    val gapless: Boolean = true,
    val playbackSpeed: Float = 1f,
    val pitchSemitones: Int = 0,
    val streamQuality: String = StreamQuality.BEST.id,
    val mobileDataStreaming: Boolean = true,
    val resumeOnStart: Boolean = true,
    // library
    val historyEnabled: Boolean = true,
    val showExplicit: Boolean = true,
    // downloads
    val downloadQuality: String = StreamQuality.BEST.id,
    val downloadWifiOnly: Boolean = true,
    // misc
    val cacheLimitMb: Int = 512,
    val showStatsSource: Boolean = true,
)

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore("melo_settings")

class SettingsRepository(private val context: Context) {

    private object K {
        val themeMode = stringPreferencesKey("theme_mode")
        val paletteId = stringPreferencesKey("palette_id")
        val backgroundStyle = stringPreferencesKey("background_style")
        val backgroundImage = stringPreferencesKey("background_image")
        val cornerRadius = intPreferencesKey("corner_radius")
        val compact = booleanPreferencesKey("compact")
        val lyricsBgArtwork = booleanPreferencesKey("lyrics_bg_artwork")
        val blur = intPreferencesKey("bg_blur")
        val dim = intPreferencesKey("bg_dim")
        val gradient = booleanPreferencesKey("bg_gradient")
        val dynamicAccent = booleanPreferencesKey("dynamic_accent")

        val lyricsMode = stringPreferencesKey("lyrics_mode")
        val lyricsSize = intPreferencesKey("lyrics_size")
        val lyricsFont = stringPreferencesKey("lyrics_font")
        val lyricsAlignCenter = booleanPreferencesKey("lyrics_align_center")
        val lyricsSpacing = intPreferencesKey("lyrics_spacing")
        val lyricsKaraoke = booleanPreferencesKey("lyrics_karaoke")
        val lyricsAutoScroll = booleanPreferencesKey("lyrics_autoscroll")
        val lyricsOffset = intPreferencesKey("lyrics_offset")

        val shuffle = booleanPreferencesKey("shuffle")
        val repeat = intPreferencesKey("repeat")
        val crossfade = intPreferencesKey("crossfade")
        val gapless = booleanPreferencesKey("gapless")
        val speed = floatPreferencesKey("speed")
        val pitch = intPreferencesKey("pitch")
        val quality = stringPreferencesKey("quality")
        val mobileData = booleanPreferencesKey("mobile_data")
        val resume = booleanPreferencesKey("resume")

        val history = booleanPreferencesKey("history_enabled")
        val explicit = booleanPreferencesKey("show_explicit")

        val downloadQuality = stringPreferencesKey("download_quality")
        val downloadWifiOnly = booleanPreferencesKey("download_wifi_only")

        val cacheLimit = intPreferencesKey("cache_limit")
        val showStats = booleanPreferencesKey("show_stats")
    }

    val settings: Flow<Settings> = context.dataStore.data.map { p ->
        Settings(
            themeMode = p[K.themeMode] ?: "dark",
            paletteId = p[K.paletteId] ?: "amber",
            backgroundStyle = p[K.backgroundStyle] ?: "gradient",
            backgroundImageUri = p[K.backgroundImage] ?: "",
            cornerRadius = p[K.cornerRadius] ?: 20,
            compact = p[K.compact] ?: false,
            lyricsBackgroundArtwork = p[K.lyricsBgArtwork] ?: true,
            backgroundBlur = p[K.blur] ?: 55,
            backgroundDim = p[K.dim] ?: 45,
            backgroundGradient = p[K.gradient] ?: true,
            dynamicAccent = p[K.dynamicAccent] ?: true,
            lyricsMode = p[K.lyricsMode] ?: LyricsMode.LINE.id,
            lyricsTextSize = p[K.lyricsSize] ?: 30,
            lyricsFont = p[K.lyricsFont] ?: "sans",
            lyricsAlignCenter = p[K.lyricsAlignCenter] ?: true,
            lyricsLineSpacing = p[K.lyricsSpacing] ?: 14,
            lyricsWordKaraoke = p[K.lyricsKaraoke] ?: true,
            lyricsAutoScroll = p[K.lyricsAutoScroll] ?: true,
            lyricsOffsetMs = p[K.lyricsOffset] ?: 0,
            shuffle = p[K.shuffle] ?: false,
            repeatMode = p[K.repeat] ?: 0,
            crossfadeSeconds = p[K.crossfade] ?: 0,
            gapless = p[K.gapless] ?: true,
            playbackSpeed = p[K.speed] ?: 1f,
            pitchSemitones = p[K.pitch] ?: 0,
            streamQuality = p[K.quality] ?: StreamQuality.BEST.id,
            mobileDataStreaming = p[K.mobileData] ?: true,
            resumeOnStart = p[K.resume] ?: true,
            historyEnabled = p[K.history] ?: true,
            showExplicit = p[K.explicit] ?: true,
            downloadQuality = p[K.downloadQuality] ?: StreamQuality.BEST.id,
            downloadWifiOnly = p[K.downloadWifiOnly] ?: true,
            cacheLimitMb = p[K.cacheLimit] ?: 512,
            showStatsSource = p[K.showStats] ?: true,
        )
    }

    suspend fun current(): Settings = settings.first()

    suspend fun setThemeMode(mode: String) = edit { it[K.themeMode] = mode }
    suspend fun setPalette(id: String) = edit { it[K.paletteId] = id }
    suspend fun setBackgroundStyle(style: String) = edit { it[K.backgroundStyle] = style }
    suspend fun setBackgroundImage(uri: String) = edit { it[K.backgroundImage] = uri }
    suspend fun setCornerRadius(radius: Int) = edit { it[K.cornerRadius] = radius.coerceIn(0, 34) }
    suspend fun setCompact(value: Boolean) = edit { it[K.compact] = value }
    suspend fun setLyricsBackgroundArtwork(value: Boolean) = edit { it[K.lyricsBgArtwork] = value }
    suspend fun setBackgroundBlur(value: Int) = edit { it[K.blur] = value.coerceIn(0, 100) }
    suspend fun setBackgroundDim(value: Int) = edit { it[K.dim] = value.coerceIn(0, 90) }
    suspend fun setBackgroundGradient(value: Boolean) = edit { it[K.gradient] = value }
    suspend fun setDynamicAccent(value: Boolean) = edit { it[K.dynamicAccent] = value }

    suspend fun setLyricsMode(mode: String) = edit { it[K.lyricsMode] = mode }
    suspend fun setLyricsTextSize(size: Int) = edit { it[K.lyricsSize] = size.coerceIn(18, 52) }
    suspend fun setLyricsFont(font: String) = edit { it[K.lyricsFont] = font }
    suspend fun setLyricsAlignCenter(value: Boolean) = edit { it[K.lyricsAlignCenter] = value }
    suspend fun setLyricsLineSpacing(value: Int) = edit { it[K.lyricsSpacing] = value.coerceIn(0, 40) }
    suspend fun setLyricsKaraoke(value: Boolean) = edit { it[K.lyricsKaraoke] = value }
    suspend fun setLyricsAutoScroll(value: Boolean) = edit { it[K.lyricsAutoScroll] = value }
    suspend fun setLyricsOffset(value: Int) = edit { it[K.lyricsOffset] = value.coerceIn(-10_000, 10_000) }

    suspend fun setShuffle(value: Boolean) = edit { it[K.shuffle] = value }
    suspend fun setRepeatMode(value: Int) = edit { it[K.repeat] = value }
    suspend fun setCrossfade(seconds: Int) = edit { it[K.crossfade] = seconds.coerceIn(0, 12) }
    suspend fun setGapless(value: Boolean) = edit { it[K.gapless] = value }
    suspend fun setPlaybackSpeed(value: Float) = edit { it[K.speed] = value.coerceIn(0.5f, 2f) }
    suspend fun setPitchSemitones(value: Int) = edit { it[K.pitch] = value.coerceIn(-12, 12) }
    suspend fun setStreamQuality(id: String) = edit { it[K.quality] = id }
    suspend fun setMobileDataStreaming(value: Boolean) = edit { it[K.mobileData] = value }
    suspend fun setResumeOnStart(value: Boolean) = edit { it[K.resume] = value }

    suspend fun setHistoryEnabled(value: Boolean) = edit { it[K.history] = value }
    suspend fun setShowExplicit(value: Boolean) = edit { it[K.explicit] = value }

    suspend fun setDownloadQuality(id: String) = edit { it[K.downloadQuality] = id }
    suspend fun setDownloadWifiOnly(value: Boolean) = edit { it[K.downloadWifiOnly] = value }

    suspend fun setCacheLimit(mb: Int) = edit { it[K.cacheLimit] = mb.coerceIn(128, 4096) }
    suspend fun setShowStatsSource(value: Boolean) = edit { it[K.showStats] = value }

    /** Reset appearance + playback prefs back to defaults, leaving the library intact. */
    suspend fun resetToDefaults() {
        context.dataStore.edit { it.clear() }
    }

    private suspend fun edit(block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        context.dataStore.edit(block)
    }
}
