package app.melo.player

import android.app.Application

class MeloApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: MeloApp
            private set
    }
}
