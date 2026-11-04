package app.melo.player.data.model

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The verified mark is a claim about an artist, so the boundary is pinned: 100,000 monthly
 * listeners qualifies, one listener fewer does not, and an artist whose count was never
 * loaded (zero) is never marked.
 */
class VerificationTest {

    private fun artist(listeners: Long) = Artist(id = "x", name = "Someone", monthlyListeners = listeners)

    @Test
    fun theThresholdIsOneHundredThousand() {
        assertThat(VerifiedMonthlyListeners).isEqualTo(100_000L)
    }

    @Test
    fun artistsBelowTheThresholdAreNotVerified() {
        assertThat(artist(0L).isVerifiedArtist).isFalse()
        assertThat(artist(1L).isVerifiedArtist).isFalse()
        assertThat(artist(99_999L).isVerifiedArtist).isFalse()
    }

    @Test
    fun artistsAtOrAboveTheThresholdAreVerified() {
        assertThat(artist(100_000L).isVerifiedArtist).isTrue()
        assertThat(artist(1_500_000L).isVerifiedArtist).isTrue()
        assertThat(artist(90_000_000L).isVerifiedArtist).isTrue()
    }

    @Test
    fun theLabelIsStableForAccessibility() {
        assertThat(VerifiedArtistLabel).isEqualTo("Verified artist")
    }
}
