package app.melo.player

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.MeloRoot
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.MeloThemeConfig
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ServiceLocator.init(this)
        enableEdgeToEdge()

        setContent {
            val app: AppViewModel = viewModel()
            val settings by app.settings.collectAsStateWithLifecycle()

            val permissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission(),
            ) { /* playback works either way; only the notification is affected */ }

            val askForNotifications = remember {
                {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        val granted = ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.POST_NOTIFICATIONS,
                        ) == PackageManager.PERMISSION_GRANTED
                        if (!granted) permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }
            }

            MeloTheme(
                config = MeloThemeConfig(
                    themeMode = settings.themeMode,
                    paletteId = settings.paletteId,
                    cornerRadius = settings.cornerRadius,
                    compact = settings.compact,
                ),
            ) {
                MeloRoot(app = app, onRequestNotificationPermission = askForNotifications)
            }
        }
    }
}
