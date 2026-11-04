package app.melo.player

/** Identity strings the UI shows. Kept in one place so they cannot drift apart. */
object AppInfo {
    const val Name = "melo"

    /** Repository the releases and the update check come from. */
    const val RepoPath = "hakosworld-blip/melo"

    /** Public home of the source. The settings screen links straight to it. */
    const val RepoUrl = "https://github.com/$RepoPath"

    /** Same address without the scheme, for display. */
    const val RepoLabel = "github.com/$RepoPath"

    // GitHub's public REST API. No token is used, so these are read-only and rate limited
    // per client; one call a day is far inside the allowance.
    const val LatestReleaseApiUrl = "https://api.github.com/repos/$RepoPath/releases/latest"
    const val ReleasesApiUrl = "https://api.github.com/repos/$RepoPath/releases?per_page=10"
    const val TagsApiUrl = "https://api.github.com/repos/$RepoPath/tags?per_page=30"

    /** Web page a tag's release lives on, used when only tags exist. */
    fun releaseTagUrl(tag: String) = "$RepoUrl/releases/tag/$tag"
}
