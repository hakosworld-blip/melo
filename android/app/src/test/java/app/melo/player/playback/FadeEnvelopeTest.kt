package app.melo.player.playback

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The fade curve decides how loud a boundary sounds, and getting it wrong is either an
 * inaudible crossfade or a track that starts silent. These pin the shape.
 */
class FadeEnvelopeTest {

    @Test
    fun noFadeMeansFullVolumeEverywhere() {
        assertThat(FadeEnvelope.volume(positionMs = 0L, durationMs = 200_000L, fadeMs = 0L))
            .isEqualTo(1f)
        assertThat(FadeEnvelope.volume(positionMs = 200_000L, durationMs = 200_000L, fadeMs = 0L))
            .isEqualTo(1f)
    }

    @Test
    fun aTrackStartsSilentAndRampsUp() {
        assertThat(FadeEnvelope.volume(positionMs = 0L, durationMs = 200_000L, fadeMs = 8_000L))
            .isEqualTo(0f)
        assertThat(FadeEnvelope.volume(positionMs = 4_000L, durationMs = 200_000L, fadeMs = 8_000L))
            .isEqualTo(0.5f)
    }

    @Test
    fun theEndOfATrackFadesAway() {
        assertThat(FadeEnvelope.volume(positionMs = 196_000L, durationMs = 200_000L, fadeMs = 8_000L))
            .isEqualTo(0.5f)
        assertThat(FadeEnvelope.volume(positionMs = 200_000L, durationMs = 200_000L, fadeMs = 8_000L))
            .isEqualTo(0f)
    }

    @Test
    fun theMiddleOfATrackIsUntouched() {
        assertThat(FadeEnvelope.volume(positionMs = 100_000L, durationMs = 200_000L, fadeMs = 8_000L))
            .isEqualTo(1f)
    }

    @Test
    fun aTrackShorterThanTwoFadesNeverGoesAboveFullVolume() {
        val volume = FadeEnvelope.volume(positionMs = 1_500L, durationMs = 3_000L, fadeMs = 8_000L)
        assertThat(volume).isAtMost(1f)
        assertThat(volume).isGreaterThan(0f)
    }

    @Test
    fun anUnknownDurationIsLeftAlone() {
        assertThat(FadeEnvelope.volume(positionMs = 0L, durationMs = 0L, fadeMs = 8_000L))
            .isEqualTo(1f)
    }
}
