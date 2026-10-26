package app.melo.player.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

data class PlaylistCount(val playlistId: Long, val count: Int)

@Dao
interface LibraryDao {

    /* favourites */
    @Query("SELECT * FROM favorites ORDER BY addedAt DESC")
    fun favorites(): Flow<List<FavoriteEntity>>

    @Query("SELECT * FROM favorites ORDER BY addedAt DESC")
    suspend fun favoritesOnce(): List<FavoriteEntity>

    @Query("SELECT trackKey FROM favorites")
    fun favoriteKeys(): Flow<List<String>>

    @Query("SELECT trackKey FROM favorites")
    suspend fun favoriteKeysOnce(): List<String>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addFavorite(entity: FavoriteEntity)

    @Query("DELETE FROM favorites WHERE trackKey = :key")
    suspend fun removeFavorite(key: String)

    /* history */
    @Query("SELECT * FROM history ORDER BY playedAt DESC LIMIT :limit")
    fun history(limit: Int = 200): Flow<List<HistoryEntity>>

    @Query("SELECT * FROM history ORDER BY playCount DESC, playedAt DESC LIMIT :limit")
    fun mostPlayed(limit: Int = 20): Flow<List<HistoryEntity>>

    @Query("SELECT * FROM history ORDER BY playedAt DESC LIMIT 1")
    fun lastPlayed(): Flow<HistoryEntity?>

    @Query("SELECT * FROM history ORDER BY playedAt DESC LIMIT 1")
    suspend fun lastPlayedOnce(): HistoryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putHistory(entity: HistoryEntity)

    @Query("SELECT playCount FROM history WHERE trackKey = :key")
    suspend fun playCount(key: String): Int?

    @Query("DELETE FROM history")
    suspend fun clearHistory()

    @Query("DELETE FROM history WHERE trackKey = :key")
    suspend fun removeHistory(key: String)

    /* playlists */
    @Query("SELECT * FROM playlists ORDER BY updatedAt DESC")
    fun playlists(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlists WHERE id = :id")
    fun playlist(id: Long): Flow<PlaylistEntity?>

    @Query("SELECT * FROM playlists WHERE id = :id")
    suspend fun playlistOnce(id: Long): PlaylistEntity?

    @Query("SELECT COUNT(*) FROM playlist_tracks WHERE playlistId = :id")
    fun trackCount(id: Long): Flow<Int>

    @Query("SELECT playlistId, COUNT(*) AS count FROM playlist_tracks GROUP BY playlistId")
    fun playlistCounts(): Flow<List<PlaylistCount>>

    @Query("SELECT * FROM playlists WHERE LOWER(name) = LOWER(:name) LIMIT 1")
    suspend fun findByName(name: String): PlaylistEntity?

    @Insert
    suspend fun insertPlaylist(entity: PlaylistEntity): Long

    @Update
    suspend fun updatePlaylist(entity: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deletePlaylist(id: Long)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :id")
    suspend fun deletePlaylistTracks(id: Long)

    @Transaction
    suspend fun deletePlaylistCascade(id: Long) {
        deletePlaylistTracks(id)
        deletePlaylist(id)
    }

    @Query("SELECT * FROM playlist_tracks WHERE playlistId = :id ORDER BY position ASC")
    fun playlistTracks(id: Long): Flow<List<PlaylistTrackEntity>>

    @Query("SELECT * FROM playlist_tracks WHERE playlistId = :id ORDER BY position ASC")
    suspend fun playlistTracksOnce(id: Long): List<PlaylistTrackEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylistTrack(entity: PlaylistTrackEntity)

    @Query("DELETE FROM playlist_tracks WHERE playlistId = :id AND trackKey = :trackKey")
    suspend fun removePlaylistTrack(id: Long, trackKey: String)

    @Query("UPDATE playlist_tracks SET position = :position WHERE playlistId = :id AND trackKey = :trackKey")
    suspend fun updatePosition(id: Long, trackKey: String, position: Int)

    @Query("SELECT MAX(position) FROM playlist_tracks WHERE playlistId = :id")
    suspend fun maxPosition(id: Long): Int?

    @Query("SELECT playlistId FROM playlist_tracks WHERE trackKey = :trackKey")
    suspend fun playlistIdsForTrack(trackKey: String): List<Long>

    /* followed artists */
    @Query("SELECT * FROM followed_artists ORDER BY addedAt DESC")
    fun followedArtists(): Flow<List<FollowedArtistEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun followArtist(entity: FollowedArtistEntity)

    @Query("DELETE FROM followed_artists WHERE LOWER(name) = LOWER(:name)")
    suspend fun unfollowArtist(name: String)

    @Query("SELECT EXISTS(SELECT 1 FROM followed_artists WHERE LOWER(name) = LOWER(:name))")
    fun isFollowing(name: String): Flow<Boolean>

    @Query("SELECT LOWER(name) FROM followed_artists")
    suspend fun followedNames(): List<String>

    /* recent searches */
    @Query("SELECT * FROM recent_searches ORDER BY searchedAt DESC LIMIT 12")
    fun recentSearches(): Flow<List<RecentSearchEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addRecentSearch(entity: RecentSearchEntity)

    @Query("DELETE FROM recent_searches")
    suspend fun clearRecentSearches()

    /* nuclear options */
    @Query("DELETE FROM playlist_tracks")
    suspend fun clearPlaylistTracks()

    @Query("DELETE FROM playlists")
    suspend fun clearPlaylists()

    @Query("DELETE FROM favorites")
    suspend fun clearFavorites()

    @Query("DELETE FROM followed_artists")
    suspend fun clearFollowed()
}

@Dao
interface DownloadDao {
    @Query("SELECT * FROM downloads ORDER BY createdAt DESC")
    fun all(): Flow<List<DownloadEntity>>

    @Query("SELECT * FROM downloads WHERE status = 'DONE' ORDER BY createdAt DESC")
    fun completed(): Flow<List<DownloadEntity>>

    @Query("SELECT * FROM downloads WHERE trackKey = :key LIMIT 1")
    suspend fun byKey(key: String): DownloadEntity?

    @Query("SELECT * FROM downloads WHERE status = 'DONE'")
    suspend fun completedOnce(): List<DownloadEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: DownloadEntity)

    @Query("UPDATE downloads SET status = :status, error = :error WHERE trackKey = :key")
    suspend fun setStatus(key: String, status: String, error: String = "")

    @Query("UPDATE downloads SET bytes = :bytes WHERE trackKey = :key")
    suspend fun setBytes(key: String, bytes: Long)

    @Query("UPDATE downloads SET filePath = :path, bytes = :bytes, status = :status, error = '' WHERE trackKey = :key")
    suspend fun complete(key: String, path: String, bytes: Long, status: String = "DONE")

    @Query("DELETE FROM downloads WHERE trackKey = :key")
    suspend fun delete(key: String)

    @Query("DELETE FROM downloads")
    suspend fun clear()

    @Query("SELECT SUM(bytes) FROM downloads WHERE status = 'DONE'")
    fun totalBytes(): Flow<Long?>
}
