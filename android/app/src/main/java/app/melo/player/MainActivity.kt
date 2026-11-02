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
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import app.melo.player.di.ServiceLocator
import app.melo.player.ui.AppViewModel
import app.melo.player.ui.MeloRoot
import app.melo.player.ui.brand.DefaultIconId
import app.melo.player.ui.brand.LauncherIcon
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.MeloThemeConfig
import androidx.core.content.ContextCompat
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ServiceLocator.init(this)
        enableEdgeToEdge()

        // The enabled launcher alias is the icon the home screen shows. Reconcile it once per
        // launch so an app update, a cleared preference or a launcher reset cannot leave melo
        // with the wrong icon (or with two).
        lifecycleScope.launch {
            val saved = runCatching { ServiceLocator.settings.current().appIconId }
                .getOrDefault(DefaultIconId)
            LauncherIcon.ensureApplied(this@MainActivity, saved)
        }

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
