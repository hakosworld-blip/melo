package app.melo.player.data.repo

import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

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
        val root = temp.newFolder("cache")
        File(root, "a.bin").writeBytes(ByteArray(120))
        val nested = File(root, "audio").apply { mkdirs() }
        File(nested, "b.bin").writeBytes(ByteArray(880))
        val deeper = File(nested, "journal").apply { mkdirs() }
        File(deeper, "c.bin").writeBytes(ByteArray(5))

        assertThat(root.dirBytes()).isEqualTo(1005L)
    }

    @Test
    fun aSingleFileCountsItsOwnLength() {
        val file = temp.newFile("one.bin")
        file.writeBytes(ByteArray(42))

        assertThat(file.dirBytes()).isEqualTo(42L)
    }
}
