package app.melo.player.data.model

/**
 * Monthly listeners an artist needs before melo shows the verified checkmark.
 *
 * Monthly listeners are the only artist-level audience number any of the free endpoints
 * publish (YouTube Music's artist page), so they are what the mark is measured against.
 */
const val VerifiedMonthlyListeners: Long = 100_000L

/** Wording used for the mark's accessibility label and for the profile line. */
const val VerifiedArtistLabel: String = "Verified artist"

/**
 * True when an artist has earned the verified mark, i.e. at least
 * [VerifiedMonthlyListeners] monthly listeners.
 *
 * The count is only known for artists whose profile has been loaded, because no list endpoint
 * carries it. Zero therefore means "not known yet", not "unpopular": such artists show no
 * badge rather than a wrong one.
 */
val Artist.isVerifiedArtist: Boolean
    get() = monthlyListeners >= VerifiedMonthlyListeners
