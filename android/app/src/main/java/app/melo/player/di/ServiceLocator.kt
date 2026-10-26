package app.melo.player.di

import android.content.Context
import app.melo.player.data.db.MeloDatabase
import app.melo.player.data.prefs.SettingsRepository
import app.melo.player.data.repo.DownloadManager
import app.melo.player.data.repo.LibraryRepository
import app.melo.player.data.repo.MusicRepository
import app.melo.player.data.repo.StreamResolver

/**
 * Hand-rolled service locator. One database, one settings store and one download
 * manager per process keeps the audio engine and library consistent.
 */
object ServiceLocator {

    @Volatile private var initialised = false

    lateinit var database: MeloDatabase
        private set
    lateinit var settings: SettingsRepository
        private set
    lateinit var library: LibraryRepository
        private set
    lateinit var music: MusicRepository
        private set
    lateinit var downloads: DownloadManager
        private set
    lateinit var resolver: StreamResolver
        private set

    fun init(context: Context) {
        if (initialised) return
        synchronized(this) {
            if (initialised) return
            val app = context.applicationContext
            database = MeloDatabase.get(app)
            settings = SettingsRepository(app)
            library = LibraryRepository(database.libraryDao())
            resolver = StreamResolver(database.downloadDao(), settings)
            music = MusicRepository(library, database.downloadDao(), settings)
            downloads = DownloadManager(app, database.downloadDao(), settings, resolver)
            initialised = true
        }
    }
}
