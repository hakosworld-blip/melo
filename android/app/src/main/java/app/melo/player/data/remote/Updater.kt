package app.melo.player.data.remote

import app.melo.player.AppInfo
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

/** One published build, reduced to what the update check needs. */
data class AppRelease(
    /** Numeric version without the tag prefix, e.g. `1.0.1` for tag `v1.0.1`. */
    val version: String,
    /** The tag as published, e.g. `v1.0.1`. */
    val tag: String,
    /** Where the user can download it. */
    val pageUrl: String,
    val notes: String? = null,
)

/**
 * Finds the newest published version of melo on GitHub.
 *
 * The repository's workflow creates a release and a tag together, so a release is normally
 * present. Older tags predate that workflow, which is why a missing release falls back to the
 * release list and then to the tag list — a tag with no release is still a version the user
 * could be behind on, and a 404 must not look like "you are up to date".
 */
object Updater {

    private const val USER_AGENT = "melo-android"

    private val HEADERS = mapOf(
        "Accept" to "application/vnd.github+json",
        "X-GitHub-Api-Version" to "2022-11-28",
    )

    suspend fun fetchLatest(): AppRelease? =
        (json(AppInfo.LatestReleaseApiUrl) as? JsonObject)?.let(::parseRelease)
            ?: (json(AppInfo.ReleasesApiUrl) as? JsonArray)?.let(::parseReleaseList)
            ?: (json(AppInfo.TagsApiUrl) as? JsonArray)?.let(::parseTagList)

    private suspend fun json(url: String): JsonElement? =
        Api.get(url, HEADERS, USER_AGENT)
            ?.let { body -> runCatching { Api.json.parseToJsonElement(body) }.getOrNull() }

    /** True when [latest] is a strictly higher version than [current]. */
    fun isNewerVersion(latest: String, current: String): Boolean =
        compareVersions(latest, current) > 0

    /**
     * Compares dotted versions numerically, so `1.10.0` beats `1.9.9`. A leading `v` and any
     * `-suffix` (such as the debug build's `-debug`) are ignored, and missing components count
     * as zero, so `1.1` and `1.1.0` are the same version.
     */
    internal fun compareVersions(a: String, b: String): Int {
        val left = versionParts(a)
        val right = versionParts(b)
        for (i in 0 until maxOf(left.size, right.size)) {
            val l = left.getOrElse(i) { 0 }
            val r = right.getOrElse(i) { 0 }
            if (l != r) return l.compareTo(r)
        }
        return 0
    }

    private fun versionParts(raw: String): List<Int> = raw
        .trim()
        .removePrefix("v")
        .removePrefix("V")
        .substringBefore('-')
        .substringBefore('+')
        .split('.')
        .map { part -> part.takeWhile(Char::isDigit).toIntOrNull() ?: 0 }

    internal fun parseRelease(obj: JsonObject?): AppRelease? {
        obj ?: return null
        val tag = obj.string("tag_name")?.takeIf { it.isNotBlank() } ?: return null
        // Drafts and pre-releases are not something a stable build should chase.
        if (obj.flag("draft") || obj.flag("prerelease")) return null
        return AppRelease(
            version = tag.removePrefix("v").removePrefix("V"),
            tag = tag,
            pageUrl = obj.string("html_url")?.takeIf { it.isNotBlank() } ?: AppInfo.releaseTagUrl(tag),
            notes = obj.string("body")?.takeIf { it.isNotBlank() },
        )
    }

    internal fun parseReleaseList(list: JsonArray?): AppRelease? = list
        ?.mapNotNull { parseRelease(it as? JsonObject) }
        ?.maxWithOrNull { a, b -> compareVersions(a.version, b.version) }

    internal fun parseTagList(list: JsonArray?): AppRelease? = list
        ?.mapNotNull { element ->
            val tag = (element as? JsonObject)?.string("name")?.takeIf { it.isNotBlank() }
                ?: return@mapNotNull null
            AppRelease(
                version = tag.removePrefix("v").removePrefix("V"),
                tag = tag,
                pageUrl = AppInfo.releaseTagUrl(tag),
            )
        }
        ?.maxWithOrNull { a, b -> compareVersions(a.version, b.version) }

    private fun JsonObject.string(key: String): String? =
        (this[key] as? JsonPrimitive)?.contentOrNull

    private fun JsonObject.flag(key: String): Boolean =
        (this[key] as? JsonPrimitive)?.booleanOrNull ?: false
}
