package app.melo.player.data.repo

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import app.melo.player.data.db.DownloadDao
import app.melo.player.data.db.DownloadEntity
import app.melo.player.data.db.toData
import app.melo.player.data.local.MeloFolder
import app.melo.player.data.local.MeloMeta
import app.melo.player.data.local.MeloMetaCodec
import app.melo.player.data.local.MeloNames
import app.melo.player.data.local.MeloSidecar
import app.melo.player.data.lyrics.LyricDocument
import app.melo.player.data.lyrics.LyricsWriter
import app.melo.player.data.model.ResolvedStream
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import app.melo.player.data.prefs.SettingsRepository
import app.melo.player.data.remote.Api
import app.melo.player.data.remote.LyricsRemote
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.util.concurrent.ConcurrentHashMap

/**
 * Offline downloads, kept in the melo folder.
 *
 * A download is not just an audio file. melo writes the song into its own folder together
 * with everything that describes it — the cover picture, timestamped lyrics and a details
 * file holding the artist, album and provider ids — so the folder is a self-contained copy
 * of the song, and deleting the song deletes exactly those files again.
 *
 * Files land in `Music/melo` on Android 10+ (user-visible storage, no permission needed)
 * and in the app's own `Music/melo` on older devices. Only catalog streams are stored;
 * nothing here circumvents DRM or a provider restriction, and a track the provider refuses
 * to serve is reported as failed instead of being written.
 */
class DownloadManager(
    private val context: Context,
    private val dao: DownloadDao,
    private val settings: SettingsRepository,
    private val resolver: StreamResolver,
    private val folder: MeloFolder,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val jobs = ConcurrentHashMap<String, Job>()

    private val _progress = MutableStateFlow<Map<String, Float>>(emptyMap())
    val progress: StateFlow<Map<String, Float>> = _progress.asStateFlow()

    private val _errors = MutableStateFlow<Map<String, String>>(emptyMap())
    val errors: StateFlow<Map<String, String>> = _errors.asStateFlow()

    /** Where songs are kept, for showing the user. */
    val folderPath: String get() = folder.displayPath

    fun isDownloading(key: String): Boolean = jobs[key]?.isActive == true

    suspend fun enqueue(track: Track) {
        if (jobs[track.key]?.isActive == true) return
        val existing = dao.byKey(track.key)
        if (existing != null && existing.status == "DONE" && folder.exists(existing.filePath)) return

        dao.upsert(
            DownloadEntity(
                trackKey = track.key,
                track = track.toData(),
                filePath = "",
                bytes = 0,
                quality = settings.current().downloadQuality,
                status = "QUEUED",
                createdAt = System.currentTimeMillis(),
            ),
        )
        jobs[track.key] = scope.launch { run(track) }
    }

    /* ------------------------------- downloading ------------------------------- */

    private suspend fun run(track: Track) {
        val key = track.key
        dao.setStatus(key, "RUNNING")
        setProgress(key, 0f)

        val resolved = resolver.resolve(track)
        if (resolved !is ResolvedStream.Remote) {
            fail(
                key,
                (resolved as? ResolvedStream.Local)?.let { "Already saved offline." }
                    ?: "Could not resolve this track for download.",
            )
            return
        }
        if (resolved.hls) {
            // An HLS stream is a playlist of segments, not one file: writing the manifest
            // would leave a song that cannot play.
            fail(key, "This track is served as an HLS stream, which melo cannot save as one file.")
            return
        }

        val quality = settings.current().downloadQuality
        val base = MeloNames.fileBase(track)
        val extension = MeloNames.extensionFor(resolved.url)
        val audioName = folder.uniqueName(base, extension, key)
        val target = folder.createAudio(audioName, MeloNames.mimeFor(extension), track)

        try {
            val written = withContext(Dispatchers.IO) { transfer(resolved.url, resolved.userAgent, target, key) }
            if (written < MIN_AUDIO_BYTES) throw IllegalStateException("Downloaded file looks invalid")
            target.finish()
            setProgress(key, 0.97f)

            // The two things that need the network: what melo would show on screen, and
            // the cover picture. Everything else is written from what came back.
            val lyrics = runCatching { LyricsRemote.fetch(track) }.getOrNull()
            val artworkBytes = track.artwork.takeIf { it.startsWith("http") }?.let(::fetchArtwork)
            val artworkRef = writeSidecars(track, base, audioName, lyrics, artworkBytes, quality)
            finishRow(key, track, audioName, written, quality, artworkRef)
            setProgress(key, 1f)
            folder.invalidate()
        } catch (e: Exception) {
            runCatching { target.discard() }
            fail(key, e.message ?: "Download failed")
        } finally {
            jobs.remove(key)
        }
    }

    /** Streams the provider's bytes straight into the folder file. */
    private fun transfer(url: String, userAgent: String?, target: MeloFolder.Target, key: String): Long {
        val request = Request.Builder()
            .url(url)
            // Fetch with the identity the URL was signed for: googlevideo answers 403 when a
            // URL minted for one client is read with another's.
            .header("User-Agent", userAgent ?: if (url.contains("googlevideo")) Api.ANDROID_VR_UA else Api.WEB_UA)
            .build()

        val response = Api.streamingClient.newCall(request).execute()
        if (!response.isSuccessful) {
            response.close()
            throw IllegalStateException("HTTP ${response.code}")
        }
        val body = response.body ?: throw IllegalStateException("Empty response")
        // A 206 only proves a range was served; the Content-Range has to cover the whole
        // file, or the saved song is a fragment that still plays.
        val total = if (response.code == 206) {
            val range = response.headers.values("Content-Range").singleOrNull()
                ?.trim()?.let(FULL_CONTENT_RANGE::matchEntire)
                ?: throw IllegalStateException("Download response has no valid full Content-Range")
            val first = range.groupValues[1].toLongOrNull()
            val last = range.groupValues[2].toLongOrNull()
            val size = range.groupValues[3].toLongOrNull()
            if (first != 0L || size == null || size <= 0 || last != size - 1 ||
                (body.contentLength() >= 0 && body.contentLength() != size)) {
                throw IllegalStateException("Download response does not contain the complete file")
            }
            size
        } else {
            body.contentLength().takeIf { it > 0 } ?: -1L
        }
        var written = 0L

        body.byteStream().use { input ->
            target.openStream().use { output ->
                val buffer = ByteArray(64 * 1024)
                var read: Int
                var lastUpdate = 0L
                while (input.read(buffer).also { read = it } > 0) {
                    output.write(buffer, 0, read)
                    written += read
                    val now = System.currentTimeMillis()
                    if (now - lastUpdate > 250) {
                        lastUpdate = now
                        setProgress(key, if (total > 0) written.toFloat() / total else 0f)
                        scope.launch { dao.setBytes(key, written) }
                    }
                }
            }
        }
        if (total > 0 && written != total) {
            throw IllegalStateException("Download ended before the complete file arrived")
        }
        return written
    }

    /**
     * Writes the rest of the song next to the audio: lyrics as `.lrc`, the cover as
     * `.jpg`, and a `.json` sidecar with the artist, album and provider ids.
     *
     * Whatever needs the network — the lyrics lookup and the cover download — has already
     * happened in [run], so this is pure file work, and the offline test drives it directly
     * to check exactly what a finished download leaves in the folder. Returns the folder
     * reference of the saved cover, if one was written.
     */
    internal suspend fun writeSidecars(
        track: Track,
        base: String,
        audioName: String,
        lyrics: LyricDocument?,
        artworkBytes: ByteArray?,
        quality: String,
    ): String? {
        val lyricsName = "$base.lrc"
        val artworkName = "$base.jpg"
        val metaName = "$base.json"

        // Lyrics: whatever melo would show on screen, saved in the format it can read back.
        val lyricsText = lyrics?.let { LyricsWriter.toLrc(it, track.title, track.artist, track.album) }
        val lyricsSaved = !lyricsText.isNullOrBlank() && folder.writeText(lyricsName, lyricsText)

        val artworkSaved = artworkBytes != null && folder.writeBytes(artworkName, artworkBytes, "image/jpeg")
        folder.invalidate()

        val meta = MeloMeta(
            trackKey = track.key,
            title = track.title,
            artist = track.artist,
            album = track.album,
            durationMs = track.durationMs,
            explicit = track.explicit,
            source = track.source.name.lowercase(),
            providerId = track.id,
            webUrl = track.webUrl,
            artworkUrl = track.artwork,
            quality = quality,
            downloadedAt = System.currentTimeMillis(),
            lyricsSource = lyrics?.source?.id ?: "none",
            lyricsSynced = lyrics?.hasLineTiming == true,
            lyricsWordTimings = lyrics?.hasWordTiming == true,
            audioFile = audioName,
            artworkFile = if (artworkSaved) artworkName else "",
            lyricsFile = if (lyricsSaved) lyricsName else "",
        )
        folder.writeText(metaName, MeloMetaCodec.encode(meta))

        return if (artworkSaved) folder.ref(artworkName) else null
    }

    private fun fetchArtwork(url: String): ByteArray? = runCatching {
        val request = Request.Builder().url(url).header("User-Agent", Api.WEB_UA).build()
        Api.streamingClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@runCatching null
            val body = response.body ?: return@runCatching null
            if (body.contentLength() > MAX_ARTWORK_BYTES) return@runCatching null
            body.bytes().takeIf { it.isNotEmpty() && it.size <= MAX_ARTWORK_BYTES }
        }
    }.getOrNull()

    /** Records the finished song, pointing the library at the picture in the folder. */
    private suspend fun finishRow(
        key: String,
        track: Track,
        audioName: String,
        bytes: Long,
        quality: String,
        artworkRef: String?,
    ) {
        val row = dao.byKey(key)
        val data = row?.track ?: track.toData()
        val finished = row?.copy(
            filePath = audioName,
            bytes = bytes,
            quality = quality,
            status = "DONE",
            error = "",
            track = data.copy(artwork = artworkRef ?: track.artwork),
        ) ?: DownloadEntity(
            trackKey = key,
            track = data.copy(artwork = artworkRef ?: track.artwork),
            filePath = audioName,
            bytes = bytes,
            quality = quality,
            status = "DONE",
            createdAt = System.currentTimeMillis(),
        )
        dao.upsert(finished)
    }

    /* --------------------------------- reading ---------------------------------- */

    /**
     * The lyrics melo saved beside this song in the folder, if the song is in the folder.
     * This is what lets a downloaded song show its lyrics with no connection: the `.lrc`
     * file is read from disk before any lyrics service is asked.
     */
    suspend fun savedLyrics(track: Track): String? = withContext(Dispatchers.IO) {
        val base = savedBaseName(track) ?: return@withContext null
        folder.readText(MeloSidecar.lyricsName(base))?.takeIf { it.isNotBlank() }
    }

    /**
     * The cover melo saved beside this song in the folder, if the song has one. Preferred
     * over the provider's artwork URL, so a downloaded song keeps its picture with no
     * connection.
     */
    suspend fun savedArtwork(track: Track): String? = withContext(Dispatchers.IO) {
        val base = savedBaseName(track) ?: return@withContext null
        folder.ref(MeloSidecar.artworkName(base))
    }

    /** Base name of this song's files in the melo folder, if it has any. */
    suspend fun savedBaseName(track: Track): String? = withContext(Dispatchers.IO) {
        MeloSidecar.baseNameFor(track, dao.byKey(track.key)?.filePath, folder.audioFiles())
    }

    /* --------------------------------- library ---------------------------------- */

    /**
     * Registers songs that are in the melo folder but not in the library yet — files melo
     * saved earlier whose row was lost, or files the user copied in. This is what makes
     * the app able to find and play music straight from the folder.
     */
    suspend fun scanFolder(): Int = withContext(Dispatchers.IO) {
        val found = folder.audioFiles()
        if (found.isEmpty()) return@withContext 0

        val known = dao.completedOnce()
            .mapNotNull { it.filePath.takeIf { path -> path.isNotBlank() } }
            .toSet()

        var added = 0
        found.forEach { file ->
            if (file.name in known) return@forEach
            val meta = folder.readMeta(MeloNames.baseName(file.name))
            val track = meta?.toTrack(folder.ref("${MeloNames.baseName(file.name)}.jpg"))
                ?: trackFromFile(file)
                ?: return@forEach
            dao.upsert(
                DownloadEntity(
                    trackKey = track.key,
                    track = track.toData(),
                    filePath = file.name,
                    bytes = file.size,
                    quality = MeloMeta.LOCAL_QUALITY,
                    status = "DONE",
                    createdAt = file.modified,
                ),
            )
            added += 1
        }
        if (added > 0) _progress.value = _progress.value
        added
    }

    /** A file with no sidecar: read what the audio itself carries. */
    private fun trackFromFile(file: MeloFolder.FolderFile): Track? = runCatching {
        val retriever = MediaMetadataRetriever()
        try {
            if (file.ref.startsWith("content://")) retriever.setDataSource(context, Uri.parse(file.ref))
            else retriever.setDataSource(Uri.parse(file.ref).path ?: file.ref)

            val title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)
                .orEmpty().trim().ifBlank { MeloNames.titleFromFile(file.name) }
            val artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
                .orEmpty().trim().ifBlank { "Unknown artist" }
            val album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)
                .orEmpty().trim()
            val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: 0L

            Track(
                id = MeloNames.localId(file.name),
                title = title,
                artist = artist,
                album = album,
                durationMs = duration,
                artwork = folder.ref("${MeloNames.baseName(file.name)}.jpg").orEmpty(),
                source = Source.LOCAL,
                streamUrl = file.ref,
            )
        } finally {
            runCatching { retriever.release() }
        }
    }.getOrNull()

    /* --------------------------------- removing --------------------------------- */

    fun cancel(key: String) {
        jobs[key]?.cancel()
        jobs.remove(key)
        scope.launch {
            dao.setStatus(key, "CANCELLED")
            _progress.value = _progress.value - key
        }
    }

    /**
     * Deletes the song and everything melo saved for it: the audio, the cover picture,
     * the lyrics file and the artist details in the sidecar.
     */
    suspend fun delete(trackKey: String) {
        jobs.remove(trackKey)?.cancel()
        val entry = dao.byKey(trackKey)
        if (entry != null && entry.filePath.isNotBlank()) {
            withContext(Dispatchers.IO) { folder.deleteSong(entry.filePath) }
        }
        dao.delete(trackKey)
        _progress.value = _progress.value - trackKey
    }

    /** Clears the songs melo downloaded; files found in the folder are left alone. */
    suspend fun clearAll() {
        val managed = dao.completedOnce().filter { it.quality != MeloMeta.LOCAL_QUALITY }
        withContext(Dispatchers.IO) {
            managed.forEach { entry ->
                if (entry.filePath.isNotBlank()) runCatching { folder.deleteSong(entry.filePath) }
            }
        }
        dao.clearManaged(MeloMeta.LOCAL_QUALITY)
        _progress.value = emptyMap()
    }

    /** Drops rows whose file is no longer in the folder (user cleared storage, etc.). */
    suspend fun pruneMissing() = withContext(Dispatchers.IO) {
        dao.completedOnce().forEach { entry ->
            if (!folder.exists(entry.filePath)) dao.delete(entry.trackKey)
        }
    }

    private suspend fun fail(key: String, message: String) {
        dao.setStatus(key, "FAILED", message)
        _errors.value = _errors.value + (key to message)
        setProgress(key, -1f)
    }

    private fun setProgress(key: String, value: Float) {
        _progress.value = _progress.value + (key to value)
    }

    private companion object {
        val FULL_CONTENT_RANGE = Regex("bytes ([0-9]+)-([0-9]+)/([0-9]+)", RegexOption.IGNORE_CASE)
        const val MIN_AUDIO_BYTES = 16L * 1024L
        const val MAX_ARTWORK_BYTES = 8L * 1024L * 1024L
    }
}
