package app.melo.player.data.remote

import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import org.junit.Test

/**
 * The update check reads public JSON, so it has to cope with GitHub's real shapes: a release
 * object, a list that may contain drafts, and a tag list for versions published before the
 * release workflow existed. Version comparison is the part that decides whether the user sees
 * "up to date" or a download button, so it is covered from both ends.
 */
class UpdaterTest {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private fun obj(text: String) = json.parseToJsonElement(text) as JsonObject
    private fun arr(text: String) = json.parseToJsonElement(text) as JsonArray

    @Test
    fun higherVersionsAreNewer() {
        assertThat(Updater.isNewerVersion("1.0.1", "1.0.0")).isTrue()
        assertThat(Updater.isNewerVersion("1.1", "1.0.9")).isTrue()
        assertThat(Updater.isNewerVersion("1.10.0", "1.9.9")).isTrue()
        assertThat(Updater.isNewerVersion("2.0", "1.99.99")).isTrue()
    }

    @Test
    fun sameOrOlderVersionsAreNotNewer() {
        assertThat(Updater.isNewerVersion("1.0.0", "1.0.0")).isFalse()
        assertThat(Updater.isNewerVersion("1.1", "1.1.0")).isFalse()
        assertThat(Updater.isNewerVersion("1.0.0", "1.0.1")).isFalse()
        assertThat(Updater.isNewerVersion("0.9.9", "1.0.0")).isFalse()
    }

    @Test
    fun tagsAndBuildSuffixesAreIgnored() {
        // Debug builds carry a -debug suffix; tags carry a v prefix.
        assertThat(Updater.isNewerVersion("v1.2.0", "1.0.0-debug")).isTrue()
        assertThat(Updater.isNewerVersion("v1.0.0", "1.0.0-debug")).isFalse()
        assertThat(Updater.isNewerVersion("1.2.0", "v1.1.0")).isTrue()
    }

    @Test
    fun aTagThatIsNotAVersionCannotLookNewer() {
        assertThat(Updater.isNewerVersion("nightly", "1.0.0")).isFalse()
        assertThat(Updater.isNewerVersion("", "1.0.0")).isFalse()
    }

    @Test
    fun releaseObjectIsParsed() {
        val release = Updater.parseRelease(
            obj(
                """
                {"tag_name":"v1.2.3","html_url":"https://github.com/hakosworld-blip/melo/releases/tag/v1.2.3",
                 "draft":false,"prerelease":false,"body":"Fixes playback"}
                """.trimIndent(),
            ),
        )

        assertThat(release).isNotNull()
        assertThat(release!!.version).isEqualTo("1.2.3")
        assertThat(release.tag).isEqualTo("v1.2.3")
        assertThat(release.pageUrl).isEqualTo("https://github.com/hakosworld-blip/melo/releases/tag/v1.2.3")
        assertThat(release.notes).isEqualTo("Fixes playback")
    }

    @Test
    fun draftsAndPrereleasesAreIgnored() {
        assertThat(Updater.parseRelease(obj("""{"tag_name":"v2.0.0","draft":true}"""))).isNull()
        assertThat(Updater.parseRelease(obj("""{"tag_name":"v2.0.0-beta","prerelease":true}"""))).isNull()
        assertThat(Updater.parseRelease(obj("""{"name":"no tag"}"""))).isNull()
    }

    @Test
    fun releaseListPicksTheHighestVersion() {
        val list = arr(
            """
            [{"tag_name":"v1.0.0","html_url":"https://example.test/1.0.0"},
             {"tag_name":"v1.10.0","html_url":"https://example.test/1.10.0"},
             {"tag_name":"v1.9.0","html_url":"https://example.test/1.9.0"},
             {"tag_name":"v3.0.0","html_url":"https://example.test/3.0.0","prerelease":true}]
            """.trimIndent(),
        )

        val newest = Updater.parseReleaseList(list)
        assertThat(newest?.version).isEqualTo("1.10.0")
        assertThat(newest?.pageUrl).isEqualTo("https://example.test/1.10.0")
    }

    @Test
    fun tagListIsTheLastResort() {
        val list = arr("""[{"name":"v1.0.0"},{"name":"v1.0.1"}]""")

        val newest = Updater.parseTagList(list)
        assertThat(newest?.version).isEqualTo("1.0.1")
        assertThat(newest?.tag).isEqualTo("v1.0.1")
        assertThat(newest?.pageUrl)
            .isEqualTo("https://github.com/hakosworld-blip/melo/releases/tag/v1.0.1")
    }

    @Test
    fun emptyBodiesDoNotCrash() {
        assertThat(Updater.parseReleaseList(arr("[]"))).isNull()
        assertThat(Updater.parseTagList(arr("[]"))).isNull()
        assertThat(Updater.parseRelease(null)).isNull()
        assertThat(Updater.parseReleaseList(null)).isNull()
    }
}
