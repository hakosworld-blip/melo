package app.melo.player.data.repo

import android.content.Context
import app.melo.player.data.db.DownloadDao
import app.melo.player.data.local.MeloFolder
import app.melo.player.data.model.ResolvedStream
import app.melo.player.data.model.Source
import app.melo.player.data.model.StreamQuality
import app.melo.player.data.model.Track
import app.melo.player.data.prefs.SettingsRepository
import app.melo.player.data.remote.SoundCloud
import app.melo.player.data.remote.YtDlp
import app.melo.player.data.remote.YouTubeMusic

/**
 * Turns a [Track] into something ExoPlayer can open.
 *
 * Order of preference: a finished download, then the provider that produced the
 * track. Metadata-only tracks (imports, third-party album pages) are matched against
 * the catalog first, exactly like the desktop app's `searchQuery` fallback.
 *
 * yt-dlp-nightly resolves the media URL first, because it is the extractor that keeps up with
 * the provider; InnerTube is the fallback for when the extractor cannot be used.
 */
class StreamResolver(
    private val downloads: DownloadDao,
    private val settings: SettingsRepository,
    private val folder: MeloFolder,
    private val context: Context,
) {

    suspend fun resolve(track: Track): ResolvedStream {
        // 1. The copy in the melo folder wins.
        val existing = downloads.byKey(track.key)
        if (existing != null && existing.status == "DONE" && folder.exists(existing.filePath)) {
            folder.ref(existing.filePath)?.let { return ResolvedStream.Local(it) }
        }

        val prefs = settings.current()

        // "Stream on mobile data: off means playback waits for Wi-Fi" is a promise the
        // settings screen makes, so it is enforced here rather than left as decoration.
        // Finished downloads returned above are files on disk and are unaffected.
        if (track.source != Source.LOCAL && !prefs.mobileDataStreaming && !onWifiOrEthernet(context)) {
            return ResolvedStream.Failure("Streaming on mobile data is off. Connect to Wi-Fi, or turn it on in Settings.")
        }

        // Stream quality is a real preference, so it has to reach the resolver: "best" and
        // "high" take the top audio format the provider offers, while "normal" trades a
        // little fidelity for data. Without this the setting reads but never applies.
        val highQuality = prefs.streamQuality != StreamQuality.NORMAL.id

        // 2. Direct provider resolution.
        when (track.source) {
            Source.YOUTUBE -> {
                val id = track.id.ifBlank { YouTubeMusic.extractVideoId(track.webUrl).orEmpty() }
                if (id.isNotBlank()) {
                    // yt-dlp nightly is the extractor now: InnerTube keeps handing back URLs the
                    // CDN refuses, which surfaced as a track that loaded and never made a sound.
                    YtDlp.resolveAudio(context, id, highQuality)?.let { return it }
                    val result = YouTubeMusic.resolveAudio(id, highQuality)
                    if (result is ResolvedStream.Remote) return result
                }
                return resolveByQuery(track, highQuality)
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
                val ref = track.streamUrl.takeIf { it.isNotBlank() && folder.exists(it) }
                    ?: return ResolvedStream.Failure("This file is no longer in the melo folder.")
                return ResolvedStream.Local(ref)
            }
        }
    }

    /** Catalog match for metadata-only tracks. */
    private suspend fun resolveByQuery(track: Track, highQuality: Boolean): ResolvedStream {
        val query = track.searchQuery.ifBlank { searchText(track) }
        val hits = YouTubeMusic.searchSongs(query, 8)
        if (hits.isEmpty()) return ResolvedStream.Failure("No match found for this track.")

        val best = hits
            .map { it to matchScore(track, it) }
            .filter { it.second > 0.45 }
            .maxByOrNull { it.second }
            ?.first
            // Metadata-only tracks (imports, third-party pages) have no id to resolve and no
            // better answer than the catalog's top hit. A track that carries a real id, though,
            // must never quietly substitute a different recording while the UI keeps showing
            // the original title — that is a wrong-song playback, not a resolution.
            ?: if (track.id.isBlank() && track.webUrl.isBlank()) hits.first()
            else return ResolvedStream.Failure("Couldn't find a close match for this track.")

        YtDlp.resolveAudio(context, best.id, highQuality)?.let { return it }

        val direct = YouTubeMusic.resolveAudio(best.id, highQuality)
        if (direct is ResolvedStream.Remote) return direct
        return ResolvedStream.Failure("This track is not streamable right now.")
    }

    /**
     * True when the live connection is Wi-Fi, Ethernet or otherwise unmetered. Unknown
     * network state counts as allowed: refusing to play because a capability lookup failed
     * would look like a broken provider rather than a data-saving rule.
     */
    private fun onWifiOrEthernet(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return true
        return caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET) ||
            !cm.isActiveNetworkMetered
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
