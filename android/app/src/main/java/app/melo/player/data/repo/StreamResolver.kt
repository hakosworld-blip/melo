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
 * When InnerTube answers without a direct media URL, the yt-dlp-nightly extractor is tried
 * for the same video id before giving up, so age-gated and freshly-broken videos still play.
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
                    val result = YouTubeMusic.resolveAudio(id, highQuality)
                    if (result is ResolvedStream.Remote) return result
                    // InnerTube had nothing usable for this id; the nightly extractor may.
                    YtDlp.resolveAudio(context, id, highQuality)?.let { return it }
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
            ?: hits.first()

        val direct = YouTubeMusic.resolveAudio(best.id, highQuality)
        if (direct is ResolvedStream.Remote) return direct

        YtDlp.resolveAudio(context, best.id, highQuality)?.let { return it }
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
