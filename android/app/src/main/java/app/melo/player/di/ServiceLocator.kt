package app.melo.player.di

import android.content.Context
import androidx.lifecycle.lifecycleScope
import app.melo.player.data.db.MeloDatabase
import app.melo.player.data.local.MeloFolder
import app.melo.player.data.prefs.SettingsRepository
import app.melo.player.data.repo.DownloadManager
import app.melo.player.data.repo.LibraryRepository
import app.melo.player.data.repo.MusicRepository
import app.melo.player.data.repo.StorageRepository
import app.melo.player.data.repo.StreamResolver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Hand-rolled service locator. One database, one settings store and one download
 * manager per process keeps the audio engine and library consistent.
 */
object ServiceLocator {

    @Volatile private var initialised = false

    @Volatile private var _lifecycleScope: CoroutineScope? = null
    @JvmStatic val lifecycleScope: CoroutineScope?
        get() = _lifecycleScope

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
    lateinit var storage: StorageRepository
        private set

    /** The `melo` folder every download is written to and read back from. */
    lateinit var folder: MeloFolder
        private set

    fun init(context: Context) {
        if (initialised) return
        synchronized(this) {
            if (initialised) return
            val app = context.applicationContext
            _lifecycleScope = (app as? androidx.lifecycle.LifecycleOwner)?.lifecycleScope
                ?: CoroutineScope(SupervisorJob() + Dispatchers.Default)
            database = MeloDatabase.get(app)
            settings = SettingsRepository(app)
            library = LibraryRepository(database.libraryDao())
            folder = MeloFolder(app)
            resolver = StreamResolver(database.downloadDao(), settings, folder, app)
            music = MusicRepository(library, database.downloadDao(), settings)
            downloads = DownloadManager(app, database.downloadDao(), settings, resolver, folder)
            storage = StorageRepository(app, folder, database.downloadDao(), library)
            initialised = true
        }
    }
}
