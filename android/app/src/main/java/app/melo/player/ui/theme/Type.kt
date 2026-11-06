package app.melo.player.ui.theme

import androidx.compose.ui.text.font.FontFamily
import app.melo.player.ui.shadcn.MeloType

/**
 * The app's type scale now comes from the shadcn tokens. Kept as a named alias so screens and
 * previews that referenced `MeloTypography` keep a stable entry point.
 */
val MeloTypography = MeloType()

fun lyricsFamily(id: String): FontFamily = when (id) {
    "serif" -> FontFamily.Serif
    "mono" -> FontFamily.Monospace
    else -> FontFamily.SansSerif
}
