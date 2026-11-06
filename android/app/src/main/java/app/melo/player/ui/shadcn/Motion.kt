package app.melo.player.ui.shadcn

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer

/**
 * Motion tokens.
 *
 * Three rules keep this subtle rather than showy: every duration is short (110-280ms), every
 * curve decelerates and none overshoots, and only transform/opacity animate so a 60fps phone
 * never relayouts for decoration. Compose scales these durations by the system animator setting,
 * so "Remove animations" in accessibility settings turns all of it off without a code branch.
 */
object MeloMotion {
    /** Press feedback: fast enough to feel like direct manipulation. */
    const val Press = 110

    /** Small state changes: colour shifts, nav selection, menu entrance. */
    const val Fast = 140

    /** Surface entrances: dialogs, content swaps. */
    const val Standard = 200

    /** Full-height or full-width movement: sheets. */
    const val Slow = 280

    /** ease-out-quart: a hard settle with no overshoot. */
    val EaseOut: Easing = CubicBezierEasing(0.25f, 1f, 0.5f, 1f)

    /** ease-out-quint: marginally snappier, for things that travel further. */
    val EaseOutQuint: Easing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
}

/**
 * The animated state layer. shadcn draws interaction as a translucent wash over the control's
 * own fill, so it is one alpha ramp rather than a ripple or a second colour.
 */
@Composable
fun pressAlpha(interaction: MutableInteractionSource, pressedAlpha: Float): Float {
    val pressed by interaction.collectIsPressedAsState()
    val alpha by animateFloatAsState(
        targetValue = if (pressed) pressedAlpha else 0f,
        animationSpec = tween(MeloMotion.Press, easing = MeloMotion.EaseOut),
        label = "press-alpha",
    )
    return alpha
}

/**
 * A slight squeeze while held. Kept at 1-4%: enough for the eye to register the press, small
 * enough that nothing on screen appears to jump.
 */
@Composable
fun Modifier.pressScale(interaction: MutableInteractionSource, pressedScale: Float = 0.98f): Modifier {
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = tween(MeloMotion.Press, easing = MeloMotion.EaseOut),
        label = "press-scale",
    )
    return this.graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}
