package app.melo.player.data.repo

import app.melo.player.data.db.FavoriteEntity
import app.melo.player.data.db.FollowedArtistEntity
import app.melo.player.data.db.HistoryEntity
import app.melo.player.data.db.LibraryDao
import app.melo.player.data.db.PlaylistEntity
import app.melo.player.data.db.PlaylistTrackEntity
import app.melo.player.data.db.RecentSearchEntity
import app.melo.player.data.db.toData
import app.melo.player.data.db.toTrack
import app.melo.player.data.model.Artist
import app.melo.player.data.model.Playlist
import app.melo.player.data.model.Track
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

/**
 * Local library: favourites, history, playlists, followed artists and search history.
 * Mirrors the desktop app's `devsize_favorites`, `devsize_history`, `devsize_playlists`
 * and `riff_favorite_artists` stores, now backed by Room so large libraries stay fast.
 */
class LibraryRepository(private val dao: LibraryDao) {

    /* --------------------------- favourites --------------------------- */

    val favorites: Flow<List<Track>> =
        dao.favorites().map { list -> list.map { it.track.toTrack() } }

    val favoriteKeys: Flow<Set<String>> =
        dao.favoriteKeys().map { it.toSet() }

    suspend fun isFavorite(key: String): Boolean = dao.favoriteKeysOnce().contains(key)

    suspend fun toggleFavorite(track: Track): Boolean {
        val key = track.key
        if (dao.favoriteKeysOnce().contains(key)) {
            dao.removeFavorite(key)
            return false
        }
        dao.addFavorite(FavoriteEntity(key, track.toData(), System.currentTimeMillis()))
        return true
    }

    /* ---------------------------- history ----------------------------- */

    val history: Flow<List<Track>> =
        dao.history(200).map { list -> list.map { it.track.toTrack() } }

    val mostPlayed: Flow<List<Pair<Track, Int>>> =
        dao.mostPlayed(20).map { list -> list.map { it.track.toTrack() to it.playCount } }

    suspend fun recordPlay(track: Track) {
        val key = track.key
        val count = dao.playCount(key) ?: 0
        dao.putHistory(
            HistoryEntity(
                trackKey = key,
                track = track.toData(),
                playedAt = System.currentTimeMillis(),
                playCount = count + 1,
            ),
        )
    }

    /** Last track that was played, used for "continue listening" and resume-on-launch. */
    suspend fun lastPlayed(): Track? = dao.lastPlayedOnce()?.track?.toTrack()

    suspend fun clearHistory() = dao.clearHistory()

    suspend fun removeFromHistory(key: String) = dao.removeHistory(key)

    /* --------------------------- playlists ---------------------------- */

    val playlists: Flow<List<Playlist>> =
        combine(dao.playlists(), dao.playlistCounts()) { list, counts ->
            val byId = counts.associate { it.playlistId to it.count }
            list.map {
                Playlist(
                    id = it.id,
                    name = it.name,
                    trackCount = byId[it.id] ?: 0,
                    createdAt = it.createdAt,
                    updatedAt = it.updatedAt,
                    coverArtwork = it.coverArtwork,
                )
            }
        }

    fun playlist(id: Long): Flow<Playlist?> = dao.playlist(id).map { e ->
        e?.let {
            Playlist(
                id = it.id,
                name = it.name,
                trackCount = 0,
                createdAt = it.createdAt,
                updatedAt = it.updatedAt,
                coverArtwork = it.coverArtwork,
            )
        }
    }

    fun playlistTracks(id: Long): Flow<List<Track>> =
        dao.playlistTracks(id).map { list -> list.map { it.track.toTrack() } }

    suspend fun createPlaylist(name: String): Long {
        val now = System.currentTimeMillis()
        return dao.insertPlaylist(
            PlaylistEntity(name = name.trim().ifBlank { "New playlist" }, createdAt = now, updatedAt = now),
        )
    }

    suspend fun renamePlaylist(id: Long, name: String) {
        dao.playlistOnce(id)?.let {
            dao.updatePlaylist(it.copy(name = name.trim().ifBlank { it.name }, updatedAt = System.currentTimeMillis()))
        }
    }

    suspend fun deletePlaylist(id: Long) = dao.deletePlaylistCascade(id)

    suspend fun addToPlaylist(playlistId: Long, track: Track): Boolean {
        val key = track.key
        val existing = dao.playlistTracksOnce(playlistId)
        if (existing.any { it.trackKey == key }) return false
        val position = (dao.maxPosition(playlistId) ?: -1) + 1
        dao.insertPlaylistTrack(
            PlaylistTrackEntity(
                playlistId = playlistId,
                trackKey = key,
                track = track.toData(),
                position = position,
                addedAt = System.currentTimeMillis(),
            ),
        )
        // Cover follows the first track, like the desktop playlist tiles.
        dao.playlistOnce(playlistId)?.let { pl ->
            if (pl.coverArtwork.isBlank() && track.artwork.isNotBlank()) {
                dao.updatePlaylist(pl.copy(coverArtwork = track.artwork, updatedAt = System.currentTimeMillis()))
            } else {
                dao.updatePlaylist(pl.copy(updatedAt = System.currentTimeMillis()))
            }
        }
        return true
    }

    suspend fun addAllToPlaylist(playlistId: Long, tracks: List<Track>): Int {
        var added = 0
        for (t in tracks) if (addToPlaylist(playlistId, t)) added++
        return added
    }

    suspend fun removeFromPlaylist(playlistId: Long, trackKey: String) {
        dao.removePlaylistTrack(playlistId, trackKey)
        reindex(playlistId)
    }

    suspend fun moveTrack(playlistId: Long, from: Int, to: Int) {
        val tracks = dao.playlistTracksOnce(playlistId).toMutableList()
        if (from !in tracks.indices || to !in tracks.indices) return
        val item = tracks.removeAt(from)
        tracks.add(to, item)
        tracks.forEachIndexed { index, t -> dao.updatePosition(playlistId, t.trackKey, index) }
    }

    private suspend fun reindex(playlistId: Long) {
        dao.playlistTracksOnce(playlistId).forEachIndexed { index, t ->
            dao.updatePosition(playlistId, t.trackKey, index)
        }
    }

    suspend fun setPlaylistCover(playlistId: Long, artwork: String) {
        dao.playlistOnce(playlistId)?.let {
            dao.updatePlaylist(it.copy(coverArtwork = artwork, updatedAt = System.currentTimeMillis()))
        }
    }

    suspend fun playlistsContaining(trackKey: String): List<Long> = dao.playlistIdsForTrack(trackKey)

    /* ------------------------ followed artists ------------------------ */

    val followedArtists: Flow<List<Artist>> = dao.followedArtists().map { list ->
        list.map {
            Artist(
                id = it.name,
                name = it.name,
                artwork = it.artwork,
                monthlyListeners = it.monthlyListeners,
            )
        }
    }

    fun isFollowing(name: String): Flow<Boolean> = dao.isFollowing(name)

    suspend fun toggleFollow(artistName: String, artwork: String = "", listeners: Long = 0L): Boolean {
        val following = dao.followedNames().contains(artistName.trim().lowercase())
        return if (following) {
            dao.unfollowArtist(artistName)
            false
        } else {
            dao.followArtist(
                FollowedArtistEntity(
                    name = artistName.trim(),
                    artwork = artwork,
                    monthlyListeners = listeners,
                    addedAt = System.currentTimeMillis(),
                ),
            )
            true
        }
    }

    /* ----------------------- recent searches -------------------------- */

    val recentSearches: Flow<List<String>> =
        dao.recentSearches().map { list -> list.map { it.query } }

    suspend fun addSearch(query: String) {
        val q = query.trim()
        if (q.length < 2) return
        dao.addRecentSearch(RecentSearchEntity(q, System.currentTimeMillis()))
    }

    suspend fun clearSearches() = dao.clearRecentSearches()

    /* --------------------------- wipes -------------------------------- */

    suspend fun clearAllLibraryData() {
        dao.clearPlaylistTracks()
        dao.clearPlaylists()
        dao.clearFavorites()
        dao.clearFollowed()
        dao.clearHistory()
        dao.clearRecentSearches()
    }
}
