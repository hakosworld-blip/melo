package app.melo.player.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        FavoriteEntity::class,
        HistoryEntity::class,
        PlaylistEntity::class,
        PlaylistTrackEntity::class,
        FollowedArtistEntity::class,
        DownloadEntity::class,
        RecentSearchEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class MeloDatabase : RoomDatabase() {
    abstract fun libraryDao(): LibraryDao
    abstract fun downloadDao(): DownloadDao

    companion object {
        @Volatile private var instance: MeloDatabase? = null

        fun get(context: Context): MeloDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                MeloDatabase::class.java,
                "melo.db",
            ).fallbackToDestructiveMigration().build().also { instance = it }
        }
    }
}
