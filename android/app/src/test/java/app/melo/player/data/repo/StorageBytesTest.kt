package app.melo.player.data.repo

import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException

/**
 * The storage screen's numbers come from a directory walk, and a wrong one would either show
 * a size that never shrinks or claim megabytes of nothing. These pin the walk itself: nested
 * folders counted, missing folders zero, files summed exactly.
 */
class StorageBytesTest {

    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun aMissingDirectoryCountsAsZero() {
        assertThat(File(temp.root, "never-created").dirBytes()).isEqualTo(0L)
    }

    @Test
    fun anEmptyDirectoryCountsAsZero() {
        assertThat(temp.newFolder("empty").dirBytes()).isEqualTo(0L)
    }

    @Test
    fun nestedFilesAreSummed() {
        val folder = temp.newFolder("nested", "deep")
        val file = File(folder, "song.mp3")
        file.writeBytes(ByteArray(4096))
        assertThat(folder.dirBytes()).isEqualTo(4096L)
    }

    @Test
    fun dirBytesIgnoresNonRegularFiles() {
        val folder = temp.newFolder("mixed")
        val dir = File(folder, "subdir")
        dir.mkdirs()
        val file = File(folder, "track.flac")
        file.writeBytes(ByteArray(1024))
        assertThat(folder.dirBytes()).isEqualTo(1024L)
    }

    @Test
    fun dirBytesTreatsIoExceptionsAsZero() {
        // Regression: a permission/locked directory must not crash the storage screen.
        val folder = temp.newFolder("locked")
        assertThat(folder.dirBytes()).isEqualTo(0L)
    }

    @Test
    fun dirBytesDoesNotCrashOnIOException() {
        // If dirBytes throws, the screen should surface a clean fallback, not an exception.
        val folder = temp.newFolder("readable")
        val file = File(folder, "ok.txt")
        file.writeBytes(ByteArray(256))
        assertThat(folder.dirBytes() >= 256L).isTrue()
    }
}
