package app.melo.player.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Immutable
data class MeloThemeConfig(
    val themeMode: String = "dark", // dark | light | system
    val paletteId: String = "spotify",
    val cornerRadius: Int = 12,
    val compact: Boolean = false,
)

/** Extra tokens Material3 does not model. */
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

// Spotty checks the default at startup; the preview stays aligned with that choice.
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

    val radius: Dp
        @Composable get() = LocalMeloConfig.current.cornerRadius.dp
}

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

    val scheme = if (dark) {
        darkColorScheme(
            primary = palette.accent,
            onPrimary = Color.White,
            primaryContainer = palette.accentSoft,
            onPrimaryContainer = palette.accent,
            secondary = palette.accent,
            background = Ink,
            onBackground = melo.textPrimary,
            surface = Surface,
            onSurface = melo.textPrimary,
            surfaceVariant = SurfaceElevated,
            onSurfaceVariant = melo.textSecondary,
            surfaceContainer = Surface,
            surfaceContainerHigh = SurfaceElevated,
            surfaceContainerHighest = SurfaceTop,
            outline = OutlineSoft,
            outlineVariant = Color(0xFF1A1A1C),
            error = Color(0xFFE08C7E),
            onError = Color(0xFF2A120E),
        )
    } else {
        lightColorScheme(
            primary = palette.accent,
            onPrimary = Color(0xFF1A1A1A),
            primaryContainer = palette.accent.copy(alpha = 0.22f),
            onPrimaryContainer = Color(0xFF2A1D0E),
            secondary = palette.accent,
            background = Paper,
            onBackground = melo.textPrimary,
            surface = Paper,
            onSurface = melo.textPrimary,
            surfaceVariant = PaperSurface,
            onSurfaceVariant = melo.textSecondary,
            surfaceContainer = PaperSurface,
            surfaceContainerHigh = PaperElevated,
            surfaceContainerHighest = Color.White,
            outline = OutlineSoftLight,
            outlineVariant = Color(0xFFEAE3D8),
            error = Color(0xFFB4553F),
            onError = Color.White,
        )
    }

    val r = config.cornerRadius
    val shapes = MeloShapes.copy(
        small = RoundedCornerShape((r * 0.5f).dp),
        medium = RoundedCornerShape(r.dp),
        large = RoundedCornerShape((r * 1.5f).dp),
        extraLarge = RoundedCornerShape((r * 2.0f).dp),
    )

    CompositionLocalProvider(
        LocalMeloColors provides melo,
        LocalMeloConfig provides config,
    ) {
        MaterialTheme(
            colorScheme = scheme,
            typography = MeloTypography,
            shapes = shapes,
            content = content,
        )
    }
}
