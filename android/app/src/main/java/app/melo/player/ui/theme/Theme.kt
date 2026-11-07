package app.melo.player.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.melo.player.ui.shadcn.LocalMeloRadius
import app.melo.player.ui.shadcn.LocalMeloScheme
import app.melo.player.ui.shadcn.LocalMeloTextStyle
import app.melo.player.ui.shadcn.LocalMeloTokens
import app.melo.player.ui.shadcn.LocalMeloType
import app.melo.player.ui.shadcn.MeloRadius
import app.melo.player.ui.shadcn.MeloScheme
import app.melo.player.ui.shadcn.MeloTokens
import app.melo.player.ui.shadcn.MeloType
import app.melo.player.ui.shadcn.meloScheme
import app.melo.player.ui.theme.MeloColors
import app.melo.player.ui.theme.MeloTheme

@Immutable
data class MeloThemeConfig(
    val themeMode: String = "dark", // dark | light | system
    val paletteId: String = "spotify",
    val cornerRadius: Int = 10,
    val compact: Boolean = false,
    /** A colour the user mixed in Customization; it takes over from the preset palette. */
    val customAccent: Color? = null,
)

/** Text and outline roles the screens read directly; the rest lives on [MeloScheme]. */
@Immutable
data class MeloColors(
    val textPrimary: Color,
    val textSecondary: Color,
    val surfaceElevated: Color,
    val outlineSoft: Color,
    val outlineStrong: Color,
    val isDark: Boolean,
    val scrim: Color,
)

// Previews and any composable outside MeloTheme stay aligned with the dark default.
val LocalMeloColors = staticCompositionLocalOf {
    MeloColors(
        textPrimary = TextPrimaryDark,
        textSecondary = TextSecondaryDark,
        surfaceElevated = SurfaceElevated,
        outlineSoft = OutlineSoft,
        outlineStrong = OutlineStrong,
        isDark = true,
        scrim = ScrimDark,
    )
}

val LocalMeloConfig = staticCompositionLocalOf { MeloThemeConfig() }

object MeloTheme {
    val colors: MeloColors
        @Composable get() = LocalMeloColors.current

    val config: MeloThemeConfig
        @Composable get() = LocalMeloConfig.current

    /** shadcn colour roles (primary/accent, border, popover, muted, destructive). */
    val scheme: MeloScheme
        @Composable get() = LocalMeloScheme.current

    /** The shadcn type scale. */
    val type: MeloType
        @Composable get() = LocalMeloType.current

    /** Base radius as a plain Dp, for artwork corners and one-off shapes. */
    val radius: Dp
        @Composable get() = LocalMeloRadius.current.md

    val radiusScale: MeloRadius
        @Composable get() = LocalMeloRadius.current

    val tokens: MeloTokens
        @Composable get() = LocalMeloTokens.current
}

/**
 * The app theme. It no longer wraps `MaterialTheme`: colours, type and radius are plain data
 * classes provided through CompositionLocals, so nothing here needs Material 3 at runtime.
 */
@Composable
fun MeloTheme(
    config: MeloThemeConfig = MeloThemeConfig(),
    content: @Composable () -> Unit,
) {
    val systemDark = isSystemInDarkTheme()
    val dark = when (config.themeMode) {
        "light" -> false
        "system" -> systemDark
        else -> true
    }
    val palette = paletteById(config.paletteId)
    // A colour the user mixed wins over the preset; otherwise the preset supplies the accent.
    val accent = config.customAccent ?: palette.accent
    val scheme = meloScheme(dark, accent)
    val type = MeloTypography
    // shadcn ships one radius; the setting moves the whole scale within a sane range.
    val radius = MeloRadius(config.cornerRadius.coerceIn(4, 16).dp)

    val melo = if (dark) {
        MeloColors(
            textPrimary = TextPrimaryDark,
            textSecondary = TextSecondaryDark,
            surfaceElevated = SurfaceElevated,
            outlineSoft = OutlineSoft,
            outlineStrong = OutlineStrong,
            isDark = true,
            scrim = ScrimDark,
        )
    } else {
        MeloColors(
            textPrimary = TextPrimaryLight,
            textSecondary = TextSecondaryLight,
            surfaceElevated = PaperElevated,
            outlineSoft = OutlineSoftLight,
            outlineStrong = OutlineSoftLight,
            isDark = false,
            scrim = Color(0xFF2A241E),
        )
    }

    val tokens = MeloTokens(scheme = scheme, type = type, radius = radius, dark = dark)

    CompositionLocalProvider(
        LocalMeloColors provides melo,
        LocalMeloConfig provides config,
        LocalMeloScheme provides scheme,
        LocalMeloType provides type,
        LocalMeloRadius provides radius,
        LocalMeloTextStyle provides type.bodyMedium,
        LocalMeloTokens provides tokens,
        content = content,
    )
}
