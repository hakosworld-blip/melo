package app.melo.player.ui

import android.net.Uri
import app.melo.player.data.model.Album
import app.melo.player.data.model.SearchPlaylist
import app.melo.player.data.remote.Api
import kotlinx.serialization.encodeToString
import java.util.Base64

/** Route table plus the tiny codec used to pass rich objects between screens. */
object Routes {
    const val HOME = "home"
    const val SEARCH = "search"
    const val LIBRARY = "library"
    const val PLAYER = "player"
    const val LYRICS = "lyrics"
    const val SETTINGS = "settings"
    const val QUEUE = "queue"
    const val ARTIST = "artist/{name}"
    const val ALBUM = "album/{payload}"
    const val PLAYLIST = "playlist/{id}"
    const val PROVIDER_PLAYLIST = "provider/{payload}"
    const val DOWNLOADS = "downloads"
    const val HISTORY = "history"
    const val IMPORT = "import"

    fun artist(name: String) = "artist/${Payloads.encode(name)}"
    fun album(album: Album) = "album/${Payloads.encode(Api.json.encodeToString(album))}"
    fun playlist(id: Long) = "playlist/$id"
    fun providerPlaylist(playlist: SearchPlaylist) =
        "provider/${Payloads.encode(Api.json.encodeToString(playlist))}"
}

object Payloads {
    fun encode(value: String): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(value.toByteArray())

    fun decode(value: String): String? = runCatching {
        String(Base64.getUrlDecoder().decode(value))
    }.getOrNull()

    fun album(value: String): Album? = decode(value)?.let {
        runCatching { Api.json.decodeFromString<Album>(it) }.getOrNull()
    }

    fun playlist(value: String): SearchPlaylist? = decode(value)?.let {
        runCatching { Api.json.decodeFromString<SearchPlaylist>(it) }.getOrNull()
    }

    fun text(value: String): String? = decode(value)

    @Suppress("unused")
    fun uriEncode(value: String): String = Uri.encode(value)
}
