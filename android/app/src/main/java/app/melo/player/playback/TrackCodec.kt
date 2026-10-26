package app.melo.player.playback

import android.net.Uri
import app.melo.player.data.model.Track
import app.melo.player.data.remote.Api
import kotlinx.serialization.encodeToString
import java.util.Base64

/**
 * Encodes a [Track] into a MediaItem URI so the media session can resolve a stream
 * without a side channel. This survives process death: Media3 restores its playlist
 * from the session, and every item carries everything needed to play itself.
 */
object TrackCodec {

    private const val SCHEME = "melo"
    private const val HOST = "track"

    fun encode(track: Track): String {
        val json = Api.json.encodeToString(track)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.toByteArray())
    }

    fun decode(token: String): Track? = runCatching {
        val json = String(Base64.getUrlDecoder().decode(token))
        Api.json.decodeFromString<Track>(json)
    }.getOrNull()

    fun uriFor(track: Track): Uri = Uri.Builder()
        .scheme(SCHEME)
        .authority(HOST)
        .appendPath(encode(track))
        .build()

    fun fromUri(uri: Uri): Track? {
        if (uri.scheme != SCHEME) return null
        val token = uri.lastPathSegment ?: return null
        return decode(token)
    }
}
