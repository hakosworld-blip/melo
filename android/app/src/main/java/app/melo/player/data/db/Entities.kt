package app.melo.player.data.db

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track

/** Track fields stored alongside library rows so the library works fully offline. */
data class TrackData(
    val trackId: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
    val artwork: String,
    val source: String,
    val explicit: Boolean,
    val searchQuery: String,
    val webUrl: String,
)

fun Track.toData() = TrackData(
    trackId = id,
    title = title,
    artist = artist,
    album = album,
    durationMs = durationMs,
    artwork = artwork,
    source = source.name,
    explicit = explicit,
    searchQuery = searchQuery,
    webUrl = webUrl,
)

fun TrackData.toTrack(): Track = Track(
    id = trackId,
    title = title,
    artist = artist,
    album = album,
    durationMs = durationMs,
    artwork = artwork,
    source = runCatching { Source.valueOf(source) }.getOrDefault(Source.YOUTUBE),
    explicit = explicit,
    searchQuery = searchQuery,
    webUrl = webUrl,
)

@Entity(tableName = "favorites")
data class FavoriteEntity(
    @PrimaryKey val trackKey: String,
    @Embedded val track: TrackData,
    val addedAt: Long,
)

@Entity(tableName = "history")
data class HistoryEntity(
    @PrimaryKey val trackKey: String,
    @Embedded val track: TrackData,
    val playedAt: Long,
    val playCount: Int,
)

@Entity(tableName = "playlists")
data class PlaylistEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val createdAt: Long,
    val updatedAt: Long,
    val coverArtwork: String = "",
)

@Entity(
    tableName = "playlist_tracks",
    primaryKeys = ["playlistId", "trackKey"],
    indices = [Index("playlistId")],
)
data class PlaylistTrackEntity(
    val playlistId: Long,
    val trackKey: String,
    @Embedded val track: TrackData,
    val position: Int,
    val addedAt: Long,
)

@Entity(tableName = "followed_artists")
data class FollowedArtistEntity(
    @PrimaryKey val name: String,
    val artwork: String,
    val monthlyListeners: Long,
    val addedAt: Long,
)

@Entity(tableName = "downloads")
data class DownloadEntity(
    @PrimaryKey val trackKey: String,
    @Embedded val track: TrackData,
    val filePath: String,
    val bytes: Long,
    val quality: String,
    val status: String,
    val createdAt: Long,
    val error: String = "",
)

@Entity(tableName = "recent_searches")
data class RecentSearchEntity(
    @PrimaryKey val query: String,
    val searchedAt: Long,
)

enum class DownloadStatus { QUEUED, RUNNING, DONE, FAILED, CANCELLED }
