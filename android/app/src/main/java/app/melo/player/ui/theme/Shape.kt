package app.melo.player.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * Corner radius follows Spotify's card language: small, confident radii rather than the very
 * rounded shapes the previous theme used. User-facing config still drives `MeloShapes`, but the
 * grid tiles, mini player and now-playing card read best with these Spotify-scale values.
 */
val MeloShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(8.dp),
    large = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 20.dp
    val xxl = 28.dp
    val screenH = 20.dp
    val navBarInset = 8.dp
    val xxs = 2.dp
}

/** Touch target floor for accessibility. */
val MinTouchTarget = 48.dp
