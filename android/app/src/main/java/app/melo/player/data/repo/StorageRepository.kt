package app.melo.player.data.repo

import android.content.Context
import coil.Coil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.withContext
import java.io.File

/** How much one storage category holds. */
data class StorageUsage(val bytes: Long = 0L, val items: Int = 0)

/** The categories the storage screen shows, measured on disk. */
data class StorageReport(
    val downloads: StorageUsage = StorageUsage(),
    val lyrics: StorageUsage = StorageUsage(),
    val cache: StorageUsage = StorageUsage(),
    val userData: StorageUsage = StorageUsage(),
    /** Free space on the device partition, so the screen can warn before writes start failing. */
    val freeBytes: Long = 0L,
) {
    val measuredBytes: Long get() = downloads.bytes + lyrics.bytes + cache.bytes + userData.bytes
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
    private val folder: app.melo.player.data.local.MeloFolder,
    private val dao: app.melo.player.data.db.DownloadDao,
    private val library: LibraryRepository,
) {

    /** A cold flow that re-measures the device storage every 3 seconds. */
    fun reportFlow(): Flow<StorageReport> = flow {
        while (true) {
            emit(report())
            kotlinx.coroutines.delay(3000)
        }
    }.flowOn(Dispatchers.IO)

    suspend fun report(): StorageReport = withContext(Dispatchers.IO) {
        val index = folder.index(maxAgeMs = 0L)
        val rows = dao.completedOnce()
        val audioNames = rows.mapNotNull { it.filePath.takeIf(String::isNotBlank) }
        val bases = audioNames.map(app.melo.player.data.local.MeloNames::baseName).toSet()

        // Cover picture and JSON sidecar are part of their download, so they are counted with
        // it rather than on their own row: deleting the song removes them too.
        val audioBytes = audioNames.sumOf { index[it]?.size ?: 0L }
        val companionBytes = index.values
            .filter { app.melo.player.data.local.MeloNames.baseName(it.name) in bases && !app.melo.player.data.local.MeloNames.isAudio(it.name) }
            .sumOf { it.size }

        val lyrics = index.values.filter { app.melo.player.data.local.MeloNames.extensionOf(it.name) in LYRICS_TYPES }

        StorageReport(
            downloads = StorageUsage(audioBytes + companionBytes, audioNames.size),
            lyrics = StorageUsage(lyrics.sumOf { it.size }, lyrics.size),
            cache = StorageUsage(cacheBytes()),
            userData = StorageUsage(userDataBytes()),
            freeBytes = app.melo.player.data.local.StorageDetector.freeBytes(context),
        )
    }

    /** Removes the saved lyrics only: audio, covers and artist metadata stay. */
    suspend fun clearLyrics(): Int = withContext(Dispatchers.IO) { folder.deleteLyrics() }

    /**
     * Empties the artwork cache and the streaming cache, and returns the bytes freed.
     * The streaming cache is cleared through media3 when it is open; deleting its files
     * directly would leave its index pointing at data that no longer exists.
     */
    @OptIn(coil.annotation.ExperimentalCoilApi::class)
    suspend fun clearCache(): Long = withContext(Dispatchers.IO) {
        val before = cacheBytes()
        runCatching { Coil.imageLoader(context).diskCache?.clear() }
        Coil.imageLoader(context).memoryCache?.clear()
        if (!app.melo.player.playback.MeloPlaybackService.clearAudioCache()) {
            runCatching { audioCacheDir().deleteRecursively() }
        }
        (before - cacheBytes()).coerceAtLeast(0L)
    }

    /** Removes every downloaded track and returns the count of audio files deleted. */
    suspend fun clearDownloads(): Int = withContext(Dispatchers.IO) {
        val rows = dao.completedOnce()
        val filePaths = rows.mapNotNull { it.filePath.takeIf(String::isNotBlank) }.distinct()
        var count = 0
        for (filePath in filePaths) {
            if (folder.deleteSong(filePath) > 0) count++
        }
        count
    }

    /**
     * Clears playlists, favourites, followed artists, listening history and recent searches.
     * Downloads, saved lyrics and settings are deliberately left alone.
     */
    suspend fun clearUserData() = withContext(Dispatchers.IO) { library.clearAllLibraryData() }

    fun cacheBytes(): Long = imageCacheDir().dirBytes() + maxOf(audioCacheDir().dirBytes(), 0L)

    /** That data is rows in the Room database, so its size is the database file and journals. */
    fun userDataBytes(): Long {
        val db = context.getDatabasePath(DB_NAME)
        return listOf(db, File(db.path + "-wal"), File(db.path + "-shm"))
            .sumOf { if (it.isFile) it.length() else 0L }
    }

    private fun imageCacheDir() = File(context.cacheDir, "image_cache")

    private fun audioCacheDir() = File(context.cacheDir, "audio")


    private companion object {
        /** Room database name; matches MeloDatabase.get. */
        const val DB_NAME = "melo.db"

        /** Extensions melo writes for lyrics; matches what the folder reports as lyrics. */
        val LYRICS_TYPES = setOf("lrc", "txt")
    }
}

/**
 * Total size of every regular file below [this] directory; 0 when it is missing or unreadable.
 *
 * [depth] bounds the walk so a symlink loop cannot recurse forever, which would otherwise
 * surface as a StackOverflowError instead of a size.
 */
internal fun File.dirBytes(depth: Int = 0): Long {
    if (depth > 8 || !exists()) return 0L
    if (isFile) return length()
    val children = listFiles() ?: return 0L
    return children.sumOf { child ->
        when {
            child.isDirectory -> child.dirBytes(depth + 1)
            child.isFile -> child.length()
            else -> 0L
        }
    }
}
