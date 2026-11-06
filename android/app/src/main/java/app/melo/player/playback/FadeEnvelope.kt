package app.melo.player.playback

/**
 * The volume curve used at a track boundary.
 *
 * ExoPlayer plays one media item at a time, so two tracks cannot overlap the way a DJ
 * crossfade does. What this produces instead is a linear fade down over the last [fadeMs] of
 * a track and a matching fade up over the first [fadeMs] of the next one, which is what a
 * single-player engine can honestly offer.
 *
 * With a zero fade the envelope is flat, so the engine's own gapless handling decides the
 * boundary and tracks that carry the right metadata join without a pause.
 */
object FadeEnvelope {

    /** 1.0 is full volume; 0.0 is silence at the exact boundary. */
    fun volume(positionMs: Long, durationMs: Long, fadeMs: Long): Float {
        if (fadeMs <= 0L || durationMs <= 0L) return 1f
        val intoTrack = positionMs.toFloat() / fadeMs
        val toEnd = (durationMs - positionMs).toFloat() / fadeMs
        // A track shorter than two fades gets a triangle rather than being pushed above 1.0.
        return minOf(intoTrack, toEnd, 1f).coerceIn(0f, 1f)
    }
}
