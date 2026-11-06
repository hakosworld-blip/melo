package app.melo.player.ui.shadcn

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * shadcn/ui's design language, ported to Compose.
 *
 * The look it encodes: a neutral zinc surface stack, one hairline border instead of any
 * elevation, a single 8dp radius, compact Geist-ish type at weight 500/600, and a sparse
 * accent. Nothing here is Material 3 - these are plain data classes plus CompositionLocals, and
 * every widget in this package is drawn from Compose Foundation.
 */

/**
 * The type scale. Names mirror Material's so screens could be migrated mechanically, but the
 * values are shadcn's: small, tight, weight 600 for headings rather than 700, and body copy at
 * 13-14sp so more content fits on a phone.
 */
@Immutable
data class MeloType(
    val displayLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 38.sp,
        lineHeight = 42.sp,
        letterSpacing = (-1.4).sp,
    ),
    val displayMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 30.sp,
        lineHeight = 34.sp,
        letterSpacing = (-1.1).sp,
    ),
    val displaySmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 30.sp,
        letterSpacing = (-0.8).sp,
    ),
    val headlineLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 21.sp,
        lineHeight = 26.sp,
        letterSpacing = (-0.5).sp,
    ),
    val headlineMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        letterSpacing = (-0.4).sp,
    ),
    val titleLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        letterSpacing = (-0.3).sp,
    ),
    val titleMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = (-0.15).sp,
    ),
    val titleSmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = (-0.1).sp,
    ),
    val bodyLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 21.sp,
    ),
    val bodyMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 19.sp,
    ),
    val bodySmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 17.sp,
    ),
    val labelLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.1.sp,
    ),
    val labelMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.2.sp,
    ),
    val labelSmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.3.sp,
    ),
)

/**
 * Colour roles, named the way shadcn names its CSS variables. `primary` is the user's accent,
 * so the accent and artwork customisation still drives the whole app; everything structural
 * around it is zinc.
 */
@Immutable
data class MeloScheme(
    val primary: Color,
    val onPrimary: Color,
    val secondary: Color,
    val onSecondary: Color,
    val tertiary: Color,
    val onTertiary: Color,
    val background: Color,
    val onBackground: Color,
    val surface: Color,
    val onSurface: Color,
    val surfaceVariant: Color,
    val onSurfaceVariant: Color,
    val surfaceContainerHigh: Color,
    val popover: Color,
    val popoverForeground: Color,
    val muted: Color,
    val mutedForeground: Color,
    val border: Color,
    val input: Color,
    val ring: Color,
    val error: Color,
    val onError: Color,
    val outline: Color,
    val outlineVariant: Color,
)

/** The style every `Text` in this package starts from, the way shadcn inherits body copy. */
val LocalMeloTextStyle = staticCompositionLocalOf { MeloType().bodyMedium }

val LocalMeloType = staticCompositionLocalOf { MeloType() }

val LocalMeloScheme = staticCompositionLocalOf<MeloScheme> {
    error("MeloTheme is missing: wrap the content in MeloTheme { }")
}

/** Radius scale around the user's chosen base radius, mirroring shadcn's `--radius`. */
@Immutable
data class MeloRadius(val base: androidx.compose.ui.unit.Dp) {
    val sm: androidx.compose.ui.unit.Dp get() = (base - 2.dp).coerceAtLeast(2.dp)
    val md: androidx.compose.ui.unit.Dp get() = base
    val lg: androidx.compose.ui.unit.Dp get() = base + 4.dp
    val xl: androidx.compose.ui.unit.Dp get() = base + 8.dp

    val shapeMd: Shape get() = RoundedCornerShape(md)
    val shapeLg: Shape get() = RoundedCornerShape(lg)
    val shapeXl: Shape get() = RoundedCornerShape(xl)
}

val LocalMeloRadius = staticCompositionLocalOf { MeloRadius(8.dp) }
