package app.melo.player.data.local

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import app.melo.player.data.model.Track
import java.io.File
import java.io.InputStream
import java.io.OutputStream

/**
 * The `melo` folder: one place for a downloaded song and everything that describes it.
 *
 * ```
 * Music/melo/Daft Punk - Get Lucky.m4a    the audio
 *            Daft Punk - Get Lucky.lrc    timestamped lyrics
 *            Daft Punk - Get Lucky.jpg    cover picture
 *            Daft Punk - Get Lucky.json   artist, album, provider ids, lyrics state
 * ```
 *
 * On Android 10+ files are written through MediaStore, so `Music/melo` is ordinary
 * user-visible storage that needs no storage permission and survives reinstalling melo.
 * On older devices — or when a device refuses a non-media file — melo falls back to its own
 * external `Music/melo`, so nothing silently fails.
 */
class MeloFolder(
    private val context: Context,
    /**
     * Android 10+ keeps the folder in public storage through MediaStore. Passing `true` uses
     * the app's own `Music/melo` instead: the same directory melo already uses below Android
     * 10, and as the fallback whenever a device refuses a non-media file. Only the offline
     * test passes it, because Robolectric has no MediaStore to write into; nothing in the app
     * sets this.
     */
    private val appFolderOnly: Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q,
) {

    private val resolver get() = context.contentResolver

    val usesMediaStore: Boolean get() = !appFolderOnly

    private val relativePath: String get() = "${Environment.DIRECTORY_MUSIC}/${MeloNames.FOLDER}"

    /** Where the folder is, in words the user can act on. */
    val displayPath: String
        get() = if (usesMediaStore) relativePath else privateDir().absolutePath

    /* -------------------------------- writing -------------------------------- */

    /**
     * One file on its way in. Bytes are streamed into it and then either published
     * ([finish]) or thrown away ([discard]), so a failed or cancelled download never
     * leaves a half-written file behind — and nothing appears in the folder until the
     * file is complete.
     */
    class Target internal constructor(
        val name: String,
        val isPublic: Boolean,
        private val open: () -> OutputStream,
        private val publish: () -> Unit,
        private val remove: () -> Unit,
    ) {
        fun openStream(): OutputStream = open()
        fun finish() = publish()
        fun discard() = remove()
    }

    fun createAudio(name: String, mime: String, track: Track): Target {
        if (usesMediaStore) {
            val extra = ContentValues().apply {
                put(MediaStore.Audio.Media.TITLE, track.title)
                if (track.artist.isNotBlank()) put(MediaStore.Audio.Media.ARTIST, track.artist)
                if (track.album.isNotBlank()) put(MediaStore.Audio.Media.ALBUM, track.album)
                if (track.durationMs > 0) put(MediaStore.Audio.Media.DURATION, track.durationMs)
            }
            mediaStoreTarget(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, name, mime, extra)
                ?.let { return it }
        }
        return fileTarget(name)
    }

    fun createSidecar(name: String, mime: String): Target {
        if (usesMediaStore) mediaStoreTarget(filesCollection(), name, mime, null)?.let { return it }
        return fileTarget(name)
    }

    fun writeText(name: String, text: String): Boolean =
        writeBytes(name, text.toByteArray(Charsets.UTF_8), "text/plain")

    fun writeBytes(name: String, bytes: ByteArray, mime: String): Boolean {
        val target = createSidecar(name, mime)
        val ok = runCatching {
            target.openStream().use { it.write(bytes) }
            target.finish()
            true
        }.getOrElse {
            target.discard()
            false
        }
        if (ok) invalidate()
        return ok
    }

    private fun mediaStoreTarget(
        collection: Uri,
        name: String,
        mime: String,
        extra: ContentValues?,
    ): Target? {
        if (!usesMediaStore) return null
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
            extra?.let { putAll(it) }
        }
        val uri = runCatching { resolver.insert(collection, values) }.getOrNull() ?: return null
        return Target(
            name = name,
            isPublic = true,
            open = { resolver.openOutputStream(uri) ?: error("Could not open $name for writing") },
            publish = {
                runCatching {
                    resolver.update(
                        uri,
                        ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) },
                        null,
                        null,
                    )
                }
                Unit
            },
            remove = {
                runCatching { resolver.delete(uri, null, null) }
                Unit
            },
        )
    }

    /** The app's own `Music/melo`: used below Android 10, and when a provider says no. */
    private fun privateDir(): File {
        val dir = File(
            context.getExternalFilesDir(Environment.DIRECTORY_MUSIC) ?: context.filesDir,
            MeloNames.FOLDER,
        )
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private fun fileTarget(name: String): Target {
        val file = File(privateDir(), name)
        val part = File(file.parentFile, "$name.part")
        return Target(
            name = name,
            isPublic = false,
            open = { part.outputStream() },
            publish = {
                if (file.exists()) file.delete()
                if (!part.renameTo(file)) error("Could not finish $name")
            },
            remove = {
                runCatching { part.delete() }
                Unit
            },
        )
    }

    private fun filesCollection(): Uri =
        MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)

    /* -------------------------------- reading -------------------------------- */

    data class FolderFile(
        val name: String,
        val ref: String,
        val mime: String,
        val size: Long,
        val modified: Long,
    ) {
        val isAudio: Boolean get() = mime.startsWith("audio/") || MeloNames.isAudio(name)
    }

    private var cachedIndex: Map<String, FolderFile> = emptyMap()
    private var cachedAt = 0L

    /**
     * Everything in the folder right now, keyed by file name. Cached briefly: playback
     * resolves the file again for every seek, and the folder only changes when melo
     * itself writes to it.
     */
    fun index(maxAgeMs: Long = 2_000L): Map<String, FolderFile> {
        if (System.currentTimeMillis() - cachedAt < maxAgeMs) return cachedIndex
        val out = LinkedHashMap<String, FolderFile>()
        if (usesMediaStore) {
            runCatching {
                val projection = arrayOf(
                    MediaStore.MediaColumns._ID,
                    MediaStore.MediaColumns.DISPLAY_NAME,
                    MediaStore.MediaColumns.MIME_TYPE,
                    MediaStore.MediaColumns.SIZE,
                    MediaStore.MediaColumns.DATE_MODIFIED,
                    MediaStore.MediaColumns.RELATIVE_PATH,
                )
                resolver.query(
                    filesCollection(),
                    projection,
                    "${MediaStore.MediaColumns.RELATIVE_PATH} LIKE ?",
                    arrayOf("$relativePath%"),
                    null,
                )?.use { cursor -> readPublic(cursor, out) }
            }
        }
        privateDir().listFiles()?.forEach { file ->
            if (file.isFile && !file.name.endsWith(".part")) {
                out[file.name] = FolderFile(
                    name = file.name,
                    ref = Uri.fromFile(file).toString(),
                    mime = mimeOf(file.name),
                    size = file.length(),
                    modified = file.lastModified(),
                )
            }
        }
        cachedIndex = out
        cachedAt = System.currentTimeMillis()
        return out
    }

    private fun readPublic(cursor: Cursor, out: MutableMap<String, FolderFile>) {
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
        val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
        val mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
        val sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
        val dateColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED)
        val pathColumn = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.RELATIVE_PATH)
        while (cursor.moveToNext()) {
            // The SQL LIKE is a wide filter; the exact folder check happens here so a
            // neighbouring `Music/melodies` never leaks in.
            if (cursor.getString(pathColumn)?.trimEnd('/') != relativePath) continue
            val name = cursor.getString(nameColumn) ?: continue
            out[name] = FolderFile(
                name = name,
                ref = ContentUris.withAppendedId(filesCollection(), cursor.getLong(idColumn)).toString(),
                mime = cursor.getString(mimeColumn).orEmpty(),
                size = cursor.getLong(sizeColumn),
                modified = cursor.getLong(dateColumn) * 1000L,
            )
        }
    }

    private fun mimeOf(fileName: String): String = when (MeloNames.extensionOf(fileName)) {
        "lrc", "txt" -> "text/plain"
        "json" -> "application/json"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        else -> MeloNames.mimeFor(MeloNames.extensionOf(fileName))
    }

    fun invalidate() {
        cachedAt = 0L
    }

    /** Songs in the folder, whatever put them there. */
    fun audioFiles(): List<FolderFile> = index(maxAgeMs = 0L).values.filter { it.isAudio }

    fun ref(fileName: String): String? = index()[fileName]?.ref

    fun readText(fileName: String): String? {
        val existing = ref(fileName) ?: return null
        return openInputRef(existing)?.use { it.readBytes().toString(Charsets.UTF_8) }
    }

    fun readMeta(baseName: String): MeloMeta? = readText("$baseName.json")?.let(MeloMetaCodec::decode)

    fun openInputRef(ref: String): InputStream? = runCatching {
        if (ref.startsWith("content://")) resolver.openInputStream(Uri.parse(ref))
        else File(Uri.parse(ref).path ?: ref).inputStream()
    }.getOrNull()

    /** True for a name in the folder, or for any `content://` / `file://` / plain path. */
    fun exists(value: String?): Boolean {
        if (value.isNullOrBlank()) return false
        return when {
            value.startsWith("content://") ->
                runCatching { resolver.openFileDescriptor(Uri.parse(value), "r") }.getOrNull() != null

            value.startsWith("file://") -> Uri.parse(value).path?.let { File(it).exists() } == true
            value.startsWith("/") -> File(value).exists()
            else -> index().containsKey(value)
        }
    }

    /* ------------------------------- deleting -------------------------------- */

    fun deleteRef(ref: String): Boolean {
        if (ref.startsWith("content://")) {
            val removed = runCatching { resolver.delete(Uri.parse(ref), null, null) }.getOrDefault(0)
            return removed > 0
        }
        return runCatching { File(Uri.parse(ref).path ?: ref).delete() }.getOrDefault(false)
    }

    fun deleteFile(fileName: String): Boolean = index()[fileName]?.let { deleteRef(it.ref) } ?: false

    /** The lyrics melo saved beside songs. Nothing else in the folder matches these types. */
    fun lyricsFiles(): List<FolderFile> =
        index(maxAgeMs = 0L).values.filter { MeloNames.extensionOf(it.name) in LYRICS_TYPES }

    /**
     * Removes only the saved lyrics, leaving the audio, its cover and the artist metadata in
     * place — the opposite of [deleteSong], which removes the whole set.
     */
    fun deleteLyrics(): Int {
        var removed = 0
        lyricsFiles().forEach { file -> if (deleteRef(file.ref)) removed += 1 }
        if (removed > 0) invalidate()
        return removed
    }

    /**
     * Deletes a song completely: the audio plus every file melo wrote to describe it —
     * the cover picture, the lyrics and the artist details in the sidecar.
     */
    fun deleteSong(audioFileName: String): Int {
        val base = MeloNames.baseName(audioFileName)
        var removed = 0
        index(maxAgeMs = 0L).forEach { (name, file) ->
            if (MeloNames.baseName(name) == base && deleteRef(file.ref)) removed += 1
        }
        invalidate()
        return removed
    }

    /** Which of lyrics / art / meta melo has stored for this song. */
    fun sidecarKinds(audioFileName: String): Set<String> {
        val base = MeloNames.baseName(audioFileName)
        val kinds = linkedSetOf<String>()
        index().forEach { (name, _) ->
            if (MeloNames.baseName(name) != base) return@forEach
            when (MeloNames.extensionOf(name)) {
                "lrc", "txt" -> kinds += "lyrics"
                "jpg", "jpeg", "png", "webp" -> kinds += "art"
                "json" -> kinds += "meta"
            }
        }
        return kinds
    }

    /**
     * `Artist - Title.m4a`, or `Artist - Title (2).m4a` when another song already owns the
     * name. The same song keeps its name, so re-downloading replaces it instead of piling
     * up copies.
     */
    private companion object {
        /** Extensions melo uses for lyrics, matching what [sidecarKinds] reports. */
        val LYRICS_TYPES = setOf("lrc", "txt")
    }

    fun uniqueName(base: String, extension: String, trackKey: String): String {
        val files = index(maxAgeMs = 0L)
        var candidate = "$base.$extension"
        var suffix = 2
        while (true) {
            files[candidate] ?: return candidate
            val owner = readMeta(MeloNames.baseName(candidate))?.trackKey
            if (owner.isNullOrBlank() || owner == trackKey) return candidate
            candidate = "$base ($suffix).$extension"
            suffix += 1
        }
    }
}
