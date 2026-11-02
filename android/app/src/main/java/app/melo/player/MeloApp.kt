package app.melo.player

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import java.io.File

class MeloApp : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    /**
     * One image loader for the whole process, with explicit caches: the same cover appears
     * in the list row, the mini player, the player and the lyrics backdrop, and it should be
     * decoded once and reused rather than re-fetched per screen.
     *
     * Crossfade is off by default — artwork inside scrolling lists fades badly and keeps two
     * bitmaps alive while it runs. The two screens where a fade is worth it (the app
     * background and the lyrics backdrop) ask for it per request.
     */
    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .memoryCache {
            MemoryCache.Builder(this)
                .maxSizePercent(0.2)
                .build()
        }
        .diskCache {
            DiskCache.Builder()
                .directory(File(cacheDir, "image_cache"))
                .maxSizeBytes(128L * 1024 * 1024)
                .build()
        }
        // Artwork endpoints rarely send cache headers; melo wants them cached regardless.
        .respectCacheHeaders(false)
        .crossfade(false)
        .build()

    companion object {
        lateinit var instance: MeloApp
            private set
    }
}
