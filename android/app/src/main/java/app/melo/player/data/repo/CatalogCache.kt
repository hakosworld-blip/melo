package app.melo.player.data.repo

import android.content.Context
import app.melo.player.data.model.HomeSection
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * The home rows as they were the last time the catalog answered.
 *
 * Offline, melo can still show what the user was looking at instead of an empty screen. The
 * rows are plain JSON, artwork is already in Coil's disk cache, and pressing play on one falls
 * back to a downloaded copy — so browsing a saved row works with no connection at all.
 */
object CatalogCache {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun write(context: Context, sections: List<HomeSection>) {
        // A failed refresh that produced nothing must not wipe a good saved catalog.
        if (sections.isEmpty()) return
        runCatching { file(context).writeText(json.encodeToString(sections)) }
    }

    fun read(context: Context): List<HomeSection> = runCatching {
        val saved = file(context)
        if (!saved.exists()) emptyList() else json.decodeFromString<List<HomeSection>>(saved.readText())
    }.getOrDefault(emptyList())

    fun clear(context: Context) {
        runCatching { file(context).delete() }
    }

    private fun file(context: Context) = File(context.filesDir, "home_catalog.json")
}
