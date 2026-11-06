package app.melo.player.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/**
 * shadcn's single-radius system: one base radius drives controls, cards and overlays, with a
 * small step either side. Material's five-size `Shapes` object is gone with the rest of M3.
 */
object Radius {
    val sm = RoundedCornerShape(6.dp)
    val md = RoundedCornerShape(8.dp)
    val lg = RoundedCornerShape(12.dp)
    val xl = RoundedCornerShape(16.dp)
}

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
