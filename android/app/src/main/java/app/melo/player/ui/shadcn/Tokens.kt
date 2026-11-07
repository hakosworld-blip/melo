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
 * elevation, a single 10dp radius, compact Geist-ish type at weight 500/600, and a sparse
 * accent. Nothing here is Material 3 - these are plain data classes plus CompositionLocals, and
 * every widget in this package is drawn from Compose Foundation.
 */

/**
 * The type scale, rescaled to what shadcn actually sets.
 *
 * shadcn headings are small and tight rather than large and airy: 24-30sp for a page title,
 * 15-16sp for a section title, 14sp for body and 12sp for labels, all with negative tracking at
 * the top of the scale. The previous scale was 15-25% larger, which is what made every screen
 * read as a Material app wearing zinc colours.
 */
@Immutable
data class MeloType(
    val displayLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 30.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.9).sp,
    ),
    val displayMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 25.sp,
        lineHeight = 30.sp,
        letterSpacing = (-0.7).sp,
    ),
    val displaySmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 21.sp,
        lineHeight = 26.sp,
        letterSpacing = (-0.5).sp,
    ),
    val headlineLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 23.sp,
        letterSpacing = (-0.35).sp,
    ),
    val headlineMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 21.sp,
        letterSpacing = (-0.25).sp,
    ),
    val titleLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
        lineHeight = 20.sp,
        letterSpacing = (-0.15).sp,
    ),
    val titleMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 19.sp,
        letterSpacing = (-0.1).sp,
    ),
    val titleSmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.sp,
    ),
    val bodyLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    val bodyMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    ),
    val bodySmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
    ),
    /** shadcn labels: 12sp, weight 500, no tracking and no uppercase transform. */
    val labelLarge: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
    ),
    val labelMedium: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
    ),
    val labelSmall: TextStyle = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 10.sp,
        lineHeight = 13.sp,
        letterSpacing = 0.1.sp,
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

/**
 * Radius scale around the user's chosen base radius, mirroring shadcn's `--radius`.
 *
 * shadcn's steps are small: controls sit at the base radius and cards add 2dp, surfaces add 6dp.
 * The previous +4/+8 steps rounded cards into pills, which is the single most Material-looking
 * thing the app did.
 */
@Immutable
data class MeloRadius(val base: androidx.compose.ui.unit.Dp) {
    val sm: androidx.compose.ui.unit.Dp get() = (base - 2.dp).coerceAtLeast(2.dp)
    val md: androidx.compose.ui.unit.Dp get() = base
    val lg: androidx.compose.ui.unit.Dp get() = base + 2.dp
    val xl: androidx.compose.ui.unit.Dp get() = base + 6.dp

    val shapeMd: Shape get() = RoundedCornerShape(md)
    val shapeLg: Shape get() = RoundedCornerShape(lg)
    val shapeXl: Shape get() = RoundedCornerShape(xl)
}

val LocalMeloRadius = staticCompositionLocalOf { MeloRadius(10.dp) }
