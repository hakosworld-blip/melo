package app.melo.player.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance

/**
 * melo palette — Spotify-inspired dark surface language.
 *
 * The app sits on a near-black base (`Ink #121212`), with progressively lighter surfaces for
 * cards, sheets and overlays. The single accent is Spotify-green (`#1DB954`): compact white
 * play buttons live on it, so a play press reads instantly. Text is splashed white with a
 * soft grey secondary so artwork stays the loudest thing on screen.
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

// Spotify-style dark surface stack.
val Ink = Color(0xFF121212)              // app background / base
val Surface = Color(0xFF181818)         // cards, list surfaces
val SurfaceElevated = Color(0xFF242428) // sheets / overlays / mini player
val SurfaceTop = Color(0xFF333338)      // strongest raised surface (now-playing art scrim)
val OutlineSoft = Color(0xFF28282D)     // dividers / inactive track holes
val OutlineStrong = Color(0xFF44444A)   // subtle border on cards
val TextPrimaryDark = Color(0xFFFFFFFF)
val TextSecondaryDark = Color(0xFFB3B3B3)
val ScrimDark = Color(0xFF000000)

// Light surface stack (rarely used; kept coherent with the dark scale).
val Paper = Color(0xFFFAF6F0)
val PaperSurface = Color(0xFFF2EDE5)
val PaperElevated = Color(0xFFFCFAF6)
val OutlineSoftLight = Color(0xFFE0D9CE)
val TextPrimaryLight = Color(0xFF17140F)
val TextSecondaryLight = Color(0xFF6E6961)
