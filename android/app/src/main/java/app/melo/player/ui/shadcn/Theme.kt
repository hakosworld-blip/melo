package app.melo.player.ui.shadcn

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.melo.player.ui.theme.Palettes
import app.melo.player.ui.theme.accentSoftFor
import app.melo.player.ui.theme.onAccentFor
import app.melo.player.ui.theme.paletteById

/** Everything a screen can ask the theme for: colours, type and the radius scale. */
@Immutable
data class MeloTokens(
    val scheme: MeloScheme,
    val type: MeloType,
    val radius: MeloRadius,
    val dark: Boolean,
)

/**
 * shadcn's zinc ramps. Dark is the default because the app is artwork-first; the light ramp is
 * the same set of roles with the values flipped, so a screen never has to branch on the mode.
 */
private val ZincDarkBackground = Color(0xFF09090B)
private val ZincDarkCard = Color(0xFF09090B)
private val ZincDarkRaised = Color(0xFF18181B)
private val ZincDarkMuted = Color(0xFF27272A)
private val ZincDarkBorder = Color(0xFF27272A)
private val ZincDarkInput = Color(0xFF27272A)
private val ZincDarkFg = Color(0xFFFAFAFA)
private val ZincDarkMutedFg = Color(0xFFA1A1AA)
private val ZincDarkSubtle = Color(0xFF3F3F46)

private val ZincLightBackground = Color(0xFFFFFFFF)
private val ZincLightRaised = Color(0xFFFFFFFF)
private val ZincLightMuted = Color(0xFFF4F4F5)
private val ZincLightBorder = Color(0xFFE4E4E7)
private val ZincLightFg = Color(0xFF09090B)
private val ZincLightMutedFg = Color(0xFF71717A)

/**
 * Builds the scheme for one mode. `primary` stays the user's accent (preset or custom), so the
 * accent picker still recolours buttons, active rows and progress; the destructive role is a
 * shadcn red that reads clearly on zinc rather than Material's container-based error pair.
 */
fun meloScheme(dark: Boolean, accent: Color): MeloScheme {
    val onAccent = onAccentFor(accent)
    val accentSoft = accentSoftFor(accent, dark)
    return if (dark) {
        MeloScheme(
            primary = accent,
            onPrimary = onAccent,
            secondary = ZincDarkMuted,
            onSecondary = ZincDarkFg,
            tertiary = accent,
            onTertiary = onAccent,
            background = ZincDarkBackground,
            onBackground = ZincDarkFg,
            surface = ZincDarkCard,
            onSurface = ZincDarkFg,
            surfaceVariant = ZincDarkRaised,
            onSurfaceVariant = ZincDarkMutedFg,
            surfaceContainerHigh = ZincDarkRaised,
            popover = ZincDarkRaised,
            popoverForeground = ZincDarkFg,
            muted = accentSoft,
            mutedForeground = ZincDarkMutedFg,
            border = ZincDarkBorder,
            input = ZincDarkInput,
            ring = accent,
            error = Color(0xFFF87171),
            onError = Color(0xFF18181B),
            outline = ZincDarkBorder,
            outlineVariant = ZincDarkSubtle,
        )
    } else {
        MeloScheme(
            primary = accent,
            onPrimary = onAccent,
            secondary = ZincLightMuted,
            onSecondary = ZincLightFg,
            tertiary = accent,
            onTertiary = onAccent,
            background = ZincLightBackground,
            onBackground = ZincLightFg,
            surface = ZincLightRaised,
            onSurface = ZincLightFg,
            surfaceVariant = ZincLightMuted,
            onSurfaceVariant = ZincLightMutedFg,
            surfaceContainerHigh = ZincLightMuted,
            popover = ZincLightRaised,
            popoverForeground = ZincLightFg,
            muted = accentSoft,
            mutedForeground = ZincLightMutedFg,
            border = ZincLightBorder,
            input = ZincLightBorder,
            ring = accent,
            error = Color(0xFFDC2626),
            onError = Color(0xFFFFFFFF),
            outline = ZincLightBorder,
            outlineVariant = Color(0xFFD4D4D8),
        )
    }
}

/** Fallback tokens, used by previews and by anything composed outside MeloTheme. */
val DefaultMeloTokens = MeloTokens(
    scheme = meloScheme(dark = true, accent = Palettes.first().accent),
    type = MeloType(),
    radius = MeloRadius(8.dp),
    dark = true,
)

val LocalMeloTokens = androidx.compose.runtime.staticCompositionLocalOf { DefaultMeloTokens }
