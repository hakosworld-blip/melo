package app.melo.player.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * melo palette. Warm, low-contrast ink tones with a single warm accent so artwork
 * stays the loudest thing on screen.
 */
@Immutable
data class MeloPalette(
    val id: String,
    val label: String,
    val accent: Color,
    val accentSoft: Color,
)

val Palettes = listOf(
    MeloPalette("amber", "Amber", Color(0xFFE6B980), Color(0xFF4A3A28)),
    MeloPalette("sea", "Sea", Color(0xFF7FB2A6), Color(0xFF2A403C)),
    MeloPalette("iris", "Iris", Color(0xFFA79BE8), Color(0xFF37315A)),
    MeloPalette("rose", "Rose", Color(0xFFE39AA8), Color(0xFF4C2E35)),
    MeloPalette("moss", "Moss", Color(0xFFA9C08A), Color(0xFF37422A)),
    MeloPalette("clay", "Clay", Color(0xFFD08F6E), Color(0xFF4A3227)),
)

fun paletteById(id: String?): MeloPalette = Palettes.firstOrNull { it.id == id } ?: Palettes.first()

// Dark
val Ink = Color(0xFF0B0B0F)
val Surface = Color(0xFF14141B)
val SurfaceElevated = Color(0xFF1C1C25)
val OutlineSoft = Color(0xFF2A2A35)
val TextPrimaryDark = Color(0xFFF3EEE6)
val TextSecondaryDark = Color(0xFFA9A5A0)

// Light
val Paper = Color(0xFFFAF6F0)
val PaperSurface = Color(0xFFF2EDE5)
val PaperElevated = Color(0xFFFCFAF6)
val OutlineSoftLight = Color(0xFFE0D9CE)
val TextPrimaryLight = Color(0xFF17140F)
val TextSecondaryLight = Color(0xFF6E6961)
