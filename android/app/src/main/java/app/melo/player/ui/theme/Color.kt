package app.melo.player.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance

/**
 * melo palette — shadcn zinc surfaces with a user-chosen accent.
 *
 * The structural colours are shadcn's neutral scale (`#09090B` base, `#27272A` borders), which
 * is what makes the app read as shadcn rather than Spotify: no tinted greys, no elevation, one
 * hairline separating every surface. The accent is still the user's, so the palette picker and
 * the custom colour mixer keep working.
 */
@Immutable
data class MeloPalette(
    val id: String,
    val label: String,
    val accent: Color,
    val accentSoft: Color,
)

val Palettes = listOf(
    MeloPalette("spotify", "Spotify", Color(0xFF1DB954), Color(0xFF181A16)),
    MeloPalette("amber", "Amber", Color(0xFFE6B980), Color(0xFF4A3A28)),
    MeloPalette("sea", "Sea", Color(0xFF7FB2A6), Color(0xFF2A403C)),
    MeloPalette("iris", "Iris", Color(0xFFA79BE8), Color(0xFF37315A)),
    MeloPalette("rose", "Rose", Color(0xFFE39AA8), Color(0xFF4C2E35)),
    MeloPalette("moss", "Moss", Color(0xFFA9C08A), Color(0xFF37422A)),
    MeloPalette("clay", "Clay", Color(0xFFD08F6E), Color(0xFF4A3227)),
)

fun paletteById(id: String?): MeloPalette = Palettes.firstOrNull { it.id == id } ?: Palettes.first()

/**
 * Companion container colour for an accent: the accent pulled back into the base surface so
 * chips and filled buttons stay readable instead of glowing. Used for both the presets and a
 * colour the user mixed, which is why it is derived rather than stored per palette.
 */
fun accentSoftFor(accent: Color, dark: Boolean): Color =
    lerp(if (dark) Ink else Paper, accent, if (dark) 0.20f else 0.16f)

/**
 * Foreground that stays legible on top of [accent]. A pale accent needs dark text; a deep one
 * needs white. Checked against relative luminance rather than assuming white always works.
 */
fun onAccentFor(accent: Color): Color =
    if (accent.luminance() > 0.5f) Color(0xFF111111) else Color.White

// shadcn zinc surface stack.
val Ink = Color(0xFF09090B)              // app background / base
val Surface = Color(0xFF09090B)          // cards sit flat on the base in shadcn
val SurfaceElevated = Color(0xFF18181B)  // popovers / sheets / mini player
val SurfaceTop = Color(0xFF27272A)       // strongest raised surface (now-playing art scrim)
val OutlineSoft = Color(0xFF27272A)      // hairline borders / dividers
val OutlineStrong = Color(0xFF3F3F46)    // inactive track, disabled edge
val TextPrimaryDark = Color(0xFFFAFAFA)
val TextSecondaryDark = Color(0xFFA1A1AA)
val ScrimDark = Color(0xFF000000)

// Light ramp, mirrored so the same roles work in both modes.
val Paper = Color(0xFFFFFFFF)
val PaperSurface = Color(0xFFF4F4F5)
val PaperElevated = Color(0xFFFFFFFF)
val OutlineSoftLight = Color(0xFFE4E4E7)
val TextPrimaryLight = Color(0xFF09090B)
val TextSecondaryLight = Color(0xFF71717A)
