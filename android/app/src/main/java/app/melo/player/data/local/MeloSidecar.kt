package app.melo.player.data.local

import app.melo.player.data.model.Track

/**
 * The files that sit beside a song in the melo folder, and how a playing [Track] is matched
 * back to them.
 *
 * Pure Kotlin, so the matching rules can be unit-tested on the JVM without a device.
 */
object MeloSidecar {

    fun lyricsName(base: String): String = "$base.lrc"

    fun artworkName(base: String): String = "$base.jpg"

    fun metaName(base: String): String = "$base.json"

    /**
     * Base name of the folder files belonging to [track], or null when the song is not in
     * the folder. Tried in order of certainty:
     *
     *  1. the library row's audio file — melo downloaded or indexed this song;
     *  2. the file the track itself points at — playing straight out of the folder;
     *  3. the name melo would give the song, matched against the audio files present.
     */
    fun baseNameFor(
        track: Track,
        rowPath: String?,
        audioFiles: List<MeloFolder.FolderFile>,
    ): String? {
        rowPath?.takeIf { it.isNotBlank() }?.let { return MeloNames.baseName(it) }

        val ref = track.streamUrl.takeIf { it.isNotBlank() && !it.startsWith("http") }
        if (ref != null) {
            audioFiles.firstOrNull { it.ref == ref }?.let { return MeloNames.baseName(it.name) }
        }

        val wanted = MeloNames.fileBase(track)
        return audioFiles.firstOrNull { MeloNames.baseName(it.name) == wanted }
            ?.let { MeloNames.baseName(it.name) }
    }
}
