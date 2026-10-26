package app.melo.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import coil.request.ImageRequest

/**
 * App background. Follows the user's choice: plain, tinted gradient, the current
 * artwork, or a photo picked from the device.
 */
@Composable
fun MeloBackground(
    style: String,
    imageUri: String,
    artwork: String? = null,
    gradient: Boolean = true,
    content: @Composable () -> Unit,
) {
    val bg = MaterialTheme.colorScheme.background
    val accent = MaterialTheme.colorScheme.primary
    val context = LocalContext.current

    val image = when (style) {
        "artwork" -> artwork
        "image" -> imageUri.ifBlank { null }
        else -> null
    }

    Box(Modifier.fillMaxSize().background(bg)) {
        if (gradient) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                accent.copy(alpha = 0.16f),
                                bg.copy(alpha = 0f),
                                bg,
                            ),
                        ),
                    ),
            )
        }
        if (image != null) {
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(image)
                    .crossfade(400)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alpha = 0.28f,
                modifier = Modifier.fillMaxSize(),
            )
            Box(
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                bg.copy(alpha = 0.55f),
                                bg.copy(alpha = 0.85f),
                                bg,
                            ),
                        ),
                    ),
            )
        }
        content()
    }
}
