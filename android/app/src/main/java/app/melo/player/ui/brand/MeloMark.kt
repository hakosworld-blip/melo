package app.melo.player.ui.brand

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.melo.player.ui.theme.MeloTheme

/**
 * The melo mark in one of the icon variants.
 *
 * The same generated vector and the same palette back the launcher icon, so the logo inside
 * the app and the icon on the home screen cannot drift apart.
 */
@Composable
fun MeloMark(
    variantId: String,
    modifier: Modifier = Modifier,
    size: Dp = 32.dp,
    highlighted: Boolean = false,
) {
    val variant = iconVariantById(variantId)
    val shape = RoundedCornerShape(size * 0.30f)
    val stops = if (variant.background.size > 1) {
        variant.background
    } else {
        listOf(variant.background.first(), variant.background.first())
    }

    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .background(Brush.linearGradient(stops))
            .then(
                if (highlighted) {
                    Modifier.border(2.dp, MeloTheme.scheme.primary, shape)
                } else {
                    Modifier
                },
            ),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(variant.markRes),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize().padding(size * 0.09f),
        )
    }
}
