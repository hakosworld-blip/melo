package app.melo.player.data.repo

import app.melo.player.data.db.DownloadDao
import app.melo.player.data.model.ResolvedStream
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import app.melo.player.data.prefs.SettingsRepository
import app.melo.player.data.remote.SoundCloud
import app.melo.player.data.remote.YouTubeMusic
import java.io.File

/**
 * Turns a [Track] into something ExoPlayer can open.
 *
 * Order of preference: a finished download, then the provider that produced the
 * track. Metadata-only tracks (imports, third-party album pages) are matched against
 * the catalog first, exactly like the desktop app's `searchQuery` fallback.
 */
class StreamResolver(
    private val downloads: DownloadDao,
    private val settings: SettingsRepository,
) {

    suspend fun resolve(track: Track): ResolvedStream {
        // 1. Offline copy wins.
        val existing = downloads.byKey(track.key)
        if (existing != null && existing.status == "DONE" && File(existing.filePath).exists()) {
            return ResolvedStream.Local(existing.filePath)
        }

        val preferHigh = settings.current().streamQuality != "normal"

        // 2. Direct provider resolution.
        when (track.source) {
            Source.YOUTUBE -> {
                val id = track.id.ifBlank { YouTubeMusic.extractVideoId(track.webUrl).orEmpty() }
                if (id.isNotBlank()) {
                    val result = YouTubeMusic.resolveAudio(id)
                    if (result is ResolvedStream.Remote) return result
                }
                return resolveByQuery(track)
            }

            Source.SOUNDCLOUD -> {
                if (track.id.isNotBlank()) {
                    val result = SoundCloud.resolveAudio(track.id, "${track.artist} ${track.title}")
                    if (result is ResolvedStream.Remote) return result
                }
                val hit = SoundCloud.resolveByQuery(searchText(track))
                    ?: return ResolvedStream.Failure("Not found on SoundCloud.")
                return SoundCloud.resolveAudio(hit.id, searchText(track))
            }

            Source.LOCAL -> {
                return if (track.streamUrl.isNotBlank() && File(track.streamUrl).exists()) {
                    ResolvedStream.Local(track.streamUrl)
                } else {
                    ResolvedStream.Failure("This file is no longer available.")
                }
            }
        }
    }

    /** Catalog match for metadata-only tracks. */
    private suspend fun resolveByQuery(track: Track): ResolvedStream {
        val query = track.searchQuery.ifBlank { searchText(track) }
        val hits = YouTubeMusic.searchSongs(query, 8)
        if (hits.isEmpty()) return ResolvedStream.Failure("No match found for this track.")

        val best = hits
            .map { it to matchScore(track, it) }
            .filter { it.second > 0.45 }
            .maxByOrNull { it.second }
            ?.first
            ?: hits.first()

        val result = YouTubeMusic.resolveAudio(best.id)
        return if (result is ResolvedStream.Remote) result
        else ResolvedStream.Failure("This track is not streamable right now.")
    }

    private fun searchText(track: Track): String =
        listOf(track.artist, track.title).filter { it.isNotBlank() }.joinToString(" ")

    private fun matchScore(target: Track, candidate: Track): Double {
        val titleScore = app.melo.player.data.remote.TextRules.similarity(target.title, candidate.title)
        val artistScore = app.melo.player.data.remote.TextRules.similarity(target.artist, candidate.artist)
        val durationScore = if (target.durationMs > 0 && candidate.durationMs > 0) {
            val delta = kotlin.math.abs(target.durationMs - candidate.durationMs)
            if (delta < 6_000) 1.0 else if (delta < 20_000) 0.5 else 0.0
        } else {
            0.5
        }
        return titleScore * 0.55 + artistScore * 0.3 + durationScore * 0.15
    }
}
