package app.melo.player.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The accent helpers decide two things the user actually sees: whether a filled button's label
 * is readable, and how strong the tinted container behind it is. Both are checked across the
 * presets and the extremes a hand-mixed accent can reach, because a custom colour is now
 * allowed to be anything.
 */
class AccentColorTest {

    @Test
    fun darkAccentsGetWhiteText() {
        assertThat(onAccentFor(Color(0xFF1DB954))).isEqualTo(Color.White)
        assertThat(onAccentFor(Color.Black)).isEqualTo(Color.White)
        assertThat(onAccentFor(Color(0xFF37315A))).isEqualTo(Color.White)
    }

    @Test
    fun paleAccentsGetDarkText() {
        assertThat(onAccentFor(Color.White)).isEqualTo(Color(0xFF111111))
        assertThat(onAccentFor(Color(0xFFFFF176))).isEqualTo(Color(0xFF111111))
    }

    @Test
    fun softAccentSitsBetweenTheSurfaceAndTheAccent() {
        val accent = Color(0xFF1DB954)

        val dark = accentSoftFor(accent, dark = true)
        assertThat(dark.luminance()).isGreaterThan(Ink.luminance())
        assertThat(dark.luminance()).isLessThan(accent.luminance())

        val light = accentSoftFor(accent, dark = false)
        assertThat(light.luminance()).isLessThan(Paper.luminance())
        assertThat(light.luminance()).isGreaterThan(accent.luminance())
    }

    @Test
    fun paletteLookupSurvivesAnUnknownCustomSelection() {
        assertThat(paletteById("spotify").id).isEqualTo("spotify")
        // A custom accent carries no palette id, and a removed preset must not crash settings.
        assertThat(paletteById(null).id).isEqualTo(Palettes.first().id)
        assertThat(paletteById("gone").id).isEqualTo(Palettes.first().id)
    }
}
