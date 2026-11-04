package app.melo.player.data.repo

import android.content.Context
import app.melo.player.data.db.DownloadDao
import app.melo.player.data.local.MeloFolder
import app.melo.player.data.local.MeloNames
import app.melo.player.playback.MeloPlaybackService
import coil.Coil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** How much one storage category holds. */
data class StorageUsage(val bytes: Long = 0L, val items: Int = 0)

/** The categories the storage screen shows, measured on disk. */
data class StorageReport(
    val downloads: StorageUsage = StorageUsage(),
    val lyrics: StorageUsage = StorageUsage(),
    val cache: StorageUsage = StorageUsage(),
) {
    val measuredBytes: Long get() = downloads.bytes + lyrics.bytes + cache.bytes
}

/**
 * Measures and frees the things melo keeps on the device.
 *
 * Downloads are measured from the library rows, so the number matches what "clear downloads"
 * will actually remove: the audio, its cover picture and the artist metadata beside it. Lyrics
 * are counted separately because they can be cleared on their own, and the caches are measured
 * from their directories.
 */
class StorageRepository(
    private val context: Context,
    private val folder: MeloFolder,
    private val dao: DownloadDao,
) {

    suspend fun report(): StorageReport = withContext(Dispatchers.IO) {
        val index = folder.index(maxAgeMs = 0L)
        val rows = dao.completedOnce()
        val audioNames = rows.mapNotNull { it.filePath.takeIf(String::isNotBlank) }
        val bases = audioNames.map(MeloNames::baseName).toSet()

        // Cover picture and JSON sidecar are part of their download, so they are counted with
        // it rather than on their own row: deleting the song removes them too.
        val audioBytes = audioNames.sumOf { index[it]?.size ?: 0L }
        val companionBytes = index.values
            .filter { MeloNames.baseName(it.name) in bases && !MeloNames.isAudio(it.name) }
            .sumOf { it.size }

        val lyrics = index.values.filter { MeloNames.extensionOf(it.name) in LYRICS_TYPES }

        StorageReport(
            downloads = StorageUsage(audioBytes + companionBytes, audioNames.size),
            lyrics = StorageUsage(lyrics.sumOf { it.size }, lyrics.size),
            cache = StorageUsage(cacheBytes()),
        )
    }

    /** Removes the saved lyrics only: audio, covers and artist metadata stay. */
    suspend fun clearLyrics(): Int = withContext(Dispatchers.IO) { folder.deleteLyrics() }

    /**
     * Empties the artwork cache and the streaming cache, and returns the bytes freed.
     * The streaming cache is cleared through media3 when it is open; deleting its files
     * directly would leave its index pointing at data that no longer exists.
     */
    suspend fun clearCache(): Long = withContext(Dispatchers.IO) {
        val before = cacheBytes()
        runCatching { Coil.imageLoader(context).diskCache?.clear() }
        Coil.imageLoader(context).memoryCache?.clear()
        if (!MeloPlaybackService.clearAudioCache()) {
            runCatching { audioCacheDir().deleteRecursively() }
        }
        (before - cacheBytes()).coerceAtLeast(0L)
    }

    fun cacheBytes(): Long = imageCacheDir().dirBytes() + maxOf(audioCacheDir().dirBytes(), 0L)

    private fun imageCacheDir() = File(context.cacheDir, "image_cache")

    private fun audioCacheDir() = File(context.cacheDir, "audio")

    private companion object {
        /** Extensions melo writes for lyrics; matches what the folder reports as lyrics. */
        val LYRICS_TYPES = setOf("lrc", "txt")
    }
}

/** Total size of every file below [this] directory; 0 when it is missing or unreadable. */
internal fun File.dirBytes(): Long {
    if (!exists()) return 0L
    if (isFile) return length()
    val children = listFiles() ?: return 0L
    return children.sumOf { child ->
        if (child.isDirectory) child.dirBytes() else child.length()
    }
}
