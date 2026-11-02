package app.melo.player.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import app.melo.player.data.db.DownloadDao
import app.melo.player.data.db.DownloadEntity
import app.melo.player.data.db.MeloDatabase
import app.melo.player.data.db.toData
import app.melo.player.data.local.MeloFolder
import app.melo.player.data.local.MeloNames
import app.melo.player.data.lyrics.LyricDocument
import app.melo.player.data.lyrics.LyricLine
import app.melo.player.data.lyrics.LyricWord
import app.melo.player.data.lyrics.LyricsMode
import app.melo.player.data.lyrics.LyricsSource
import app.melo.player.data.lyrics.LyricsSync
import app.melo.player.data.model.ResolvedStream
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import app.melo.player.data.prefs.SettingsRepository
import app.melo.player.data.remote.LyricsRemote
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * A downloaded song, played with the phone offline.
 *
 * The song describes itself with metadata no lyrics service can match and an artwork URL on
 * the reserved `.invalid` domain, so if these assertions pass then its lyrics, its cover and
 * its audio can only have come off the disk in the melo folder.
 *
 * Runs on the JVM through Robolectric — the same ContentResolver, Room database and files the
 * app itself uses — because the build machine has no emulator, and Robolectric has no
 * MediaStore, so the folder runs against the app's own `Music/melo` here. What it therefore
 * cannot cover is the MediaStore half of the folder on a real Android 10+ phone;
 * MELO-OFFLINE-CHECKLIST.txt walks that through on the device.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class OfflineDownloadedSongTest {

    private lateinit var db: MeloDatabase
    private lateinit var dao: DownloadDao
    private lateinit var folder: MeloFolder
    private lateinit var resolver: StreamResolver
    private lateinit var downloads: DownloadManager

    private val audio = "audio bytes that stand in for a song".toByteArray()

    private val cover = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte()) +
        "jpeg cover bytes".toByteArray()

    /** Nothing any lyrics service could possibly return. */
    private val track = Track(
        id = "zq7",
        title = "Offline Only Zq7",
        artist = "Zzqw Melo Tester",
        album = "Folder Test",
        durationMs = 180_000,
        artwork = "https://art.invalid/zq7.jpg",
        source = Source.YOUTUBE,
    )

    /** What the lyrics lookup returned while the song was being downloaded. */
    private val lyrics = LyricDocument(
        lines = listOf(
            LyricLine("Zzqw counts the lines", 0, 12_500),
            LyricLine(
                text = "one two three",
                startMs = 12_500,
                endMs = 20_000,
                words = listOf(
                    LyricWord("one", 12_500, 14_000),
                    LyricWord("two", 14_000, 15_500),
                    LyricWord("three", 15_500, 17_000),
                ),
            ),
            LyricLine("lines fall in time", 20_000, 24_000),
        ),
        source = LyricsSource.NETEASE,
    )

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, MeloDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = db.downloadDao()
        folder = MeloFolder(context, appFolderOnly = true)
        val settings = SettingsRepository(context)
        resolver = StreamResolver(dao, settings, folder)
        downloads = DownloadManager(context, dao, settings, resolver, folder)
    }

    @After
    fun tearDown() {
        db.close()
    }

    /**
     * Leaves the folder and the library in exactly the state a finished download leaves
     * them: the audio through the folder, then the sidecars through the downloader's own
     * writer, then the library row pointing at what was saved.
     */
    private suspend fun download(): String {
        val base = MeloNames.fileBase(track)
        val audioName = folder.uniqueName(base, "m4a", track.key)
        folder.createAudio(audioName, MeloNames.mimeFor("m4a"), track).let { target ->
            target.openStream().use { it.write(audio) }
            target.finish()
        }
        val artworkRef = downloads.writeSidecars(track, base, audioName, lyrics, cover, "best")
        dao.upsert(
            DownloadEntity(
                trackKey = track.key,
                track = track.toData().copy(artwork = artworkRef.orEmpty()),
                filePath = audioName,
                bytes = audio.size.toLong(),
                quality = "best",
                status = "DONE",
                createdAt = 1L,
            ),
        )
        folder.invalidate()
        return audioName
    }

    @Test
    fun `the song is written as audio plus lyrics, cover and artist details`() = runTest {
        val audioName = download()

        assertThat(folder.sidecarKinds(audioName))
            .containsExactly("lyrics", "art", "meta")
    }

    @Test
    fun `playback resolves to the file in the folder, not the provider`() = runTest {
        val audioName = download()

        assertThat(resolver.resolve(track)).isEqualTo(ResolvedStream.Local(folder.ref(audioName)!!))
    }

    @Test
    fun `the saved cover wins over the artwork URL`() = runTest {
        download()

        val saved = downloads.savedArtwork(track)
        assertThat(saved).isNotNull()
        assertThat(saved).isNotEqualTo(track.artwork)
        assertThat(folder.exists(saved!!)).isTrue()
        // What is in the folder is the picture, not an empty placeholder file.
        assertThat(folder.openInputRef(saved)!!.use { it.readBytes().toList() })
            .isEqualTo(cover.toList())
    }

    @Test
    fun `the song's own lyrics file is the one that gets read`() = runTest {
        download()

        assertThat(downloads.savedBaseName(track)).isEqualTo("Zzqw Melo Tester - Offline Only Zq7")
        val text = downloads.savedLyrics(track)
        assertThat(text).isNotNull()
        assertThat(text!!).contains("[ti:Offline Only Zq7]")
    }

    @Test
    fun `the saved file parses back into synced lyrics`() = runTest {
        download()

        val doc = LyricsRemote.fetch(track, custom = downloads.savedLyrics(track))

        assertThat(doc.source).isEqualTo(LyricsSource.CUSTOM)
        assertThat(doc.hasLineTiming).isTrue()
        assertThat(doc.hasWordTiming).isTrue()
        assertThat(doc.lines.map { it.text })
            .containsExactly("Zzqw counts the lines", "one two three", "lines fall in time")
            .inOrder()
        assertThat(doc.lines[1].words.map { it.text })
            .containsExactly("one", "two", "three")
            .inOrder()
        // Word-by-word mode is available, which is what the screen's mode chip asks for.
        assertThat(doc.supportedMode(LyricsMode.WORD)).isEqualTo(LyricsMode.WORD)
    }

    @Test
    fun `the highlight follows the clock`() = runTest {
        download()

        val lines = LyricsRemote.fetch(track, custom = downloads.savedLyrics(track)).lines

        assertThat(LyricsSync.activeLine(lines, 0)).isEqualTo(0)
        assertThat(LyricsSync.activeLine(lines, 13_000)).isEqualTo(1)
        assertThat(LyricsSync.activeLine(lines, 21_000)).isEqualTo(2)
        assertThat(LyricsSync.activeWord(lines[1], 12_600)).isEqualTo(0)
        assertThat(LyricsSync.activeWord(lines[1], 14_100)).isEqualTo(1)
        assertThat(LyricsSync.activeWord(lines[1], 15_600)).isEqualTo(2)
    }

    @Test
    fun `a song melo never saved falls back to the lyrics services`() = runTest {
        download()

        val stranger = track.copy(id = "other", title = "Never Saved By Melo")

        assertThat(downloads.savedBaseName(stranger)).isNull()
        assertThat(downloads.savedLyrics(stranger)).isNull()
        assertThat(downloads.savedArtwork(stranger)).isNull()
    }

    @Test
    fun `a file copied into the folder uses the lyrics saved beside it`() = runTest {
        val copied = "Zzqw - Copied By Hand.mp3"
        folder.createAudio(copied, "audio/mpeg", track.copy(source = Source.LOCAL)).let { target ->
            target.openStream().use { it.write(audio) }
            target.finish()
        }
        folder.writeText("Zzqw - Copied By Hand.lrc", "[00:01.00]a line from a copied file\n")
        folder.invalidate()

        val fromFolder = Track(
            id = "",
            title = "Copied By Hand",
            artist = "Zzqw",
            source = Source.LOCAL,
            streamUrl = folder.ref(copied)!!,
        )

        assertThat(downloads.savedLyrics(fromFolder))
            .isEqualTo("[00:01.00]a line from a copied file\n")
    }
}
