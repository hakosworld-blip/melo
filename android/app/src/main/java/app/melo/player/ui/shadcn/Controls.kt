package app.melo.player.ui.shadcn

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.melo.player.ui.theme.MeloTheme
import kotlin.math.roundToInt

/*
 * shadcn controls, drawn from Compose Foundation.
 *
 * Two rules from shadcn carry the look: a control is a flat rectangle with a 1dp border and the
 * shared radius (never a pill, never an elevation), and interaction is a state layer - the
 * surface lifts by ~8% on press - rather than a ripple. Both are implemented here once.
 */

/** shadcn's button variants. `Primary` uses the user's accent. */
enum class MeloButtonVariant { Primary, Secondary, Outline, Ghost, Destructive, Link }

/** shadcn's sizes: 32 / 36 / 40dp tall with matching horizontal padding. */
enum class MeloButtonSize { Sm, Md, Lg }

private data class ButtonPaint(val fill: Color, val content: Color, val stroke: Color?)

@Composable
private fun MeloTheme.buttonPaint(variant: MeloButtonVariant): ButtonPaint {
    val scheme = MeloTheme.scheme
    return when (variant) {
        MeloButtonVariant.Primary -> ButtonPaint(scheme.primary, scheme.onPrimary, null)
        MeloButtonVariant.Secondary -> ButtonPaint(scheme.secondary, scheme.onSecondary, null)
        MeloButtonVariant.Outline -> ButtonPaint(Color.Transparent, scheme.onBackground, scheme.border)
        MeloButtonVariant.Ghost -> ButtonPaint(Color.Transparent, scheme.onBackground, null)
        MeloButtonVariant.Destructive -> ButtonPaint(scheme.error, scheme.onError, null)
        MeloButtonVariant.Link -> ButtonPaint(Color.Transparent, scheme.primary, null)
    }
}

/**
 * A shadcn button. Text-only by design: the old `TextButton` call sites wanted a label plus an
 * action, which is exactly this signature.
 */
@Composable
fun MeloButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: MeloButtonVariant = MeloButtonVariant.Primary,
    size: MeloButtonSize = MeloButtonSize.Md,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) {
    val paint = MeloTheme.buttonPaint(variant)
    val height = when (size) {
        MeloButtonSize.Sm -> 32.dp
        MeloButtonSize.Md -> 36.dp
        MeloButtonSize.Lg -> 40.dp
    }
    val side = when (size) {
        MeloButtonSize.Sm -> 12.dp
        MeloButtonSize.Md -> 16.dp
        MeloButtonSize.Lg -> 20.dp
    }
    val shape = RoundedCornerShape(MeloTheme.radiusScale.md)
    val interaction = remember { MutableInteractionSource() }
    val content = if (enabled) paint.content else paint.content.copy(alpha = 0.45f)
    val fill = if (enabled) paint.fill else paint.fill.copy(alpha = 0.45f)

    Box(
        modifier = modifier
            .height(height)
            .clip(shape)
            .background(fill)
            .then(if (paint.stroke != null) Modifier.border(1.dp, paint.stroke, shape) else Modifier)
            .background(paint.content.copy(alpha = pressAlpha(interaction, 0.10f)))
            .then(Modifier.pressScale(interaction, 0.98f))
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick,
            )
            .padding(horizontal = side),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (leadingIcon != null) Icon(leadingIcon, contentDescription = null, modifier = Modifier.size(15.dp), tint = content)
            Text(label, style = MeloTheme.type.labelLarge, color = content, maxLines = 1)
        }
    }
}

/**
 * Ghost icon button, 36dp square with the shared radius. shadcn has no circular icon button, so
 * row actions read as quiet squares that light up on press.
 */
@Composable
fun MeloIconButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: Dp = 36.dp,
    content: @Composable () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val shape = RoundedCornerShape(MeloTheme.radiusScale.md)
    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .background(MeloTheme.scheme.onBackground.copy(alpha = pressAlpha(interaction, 0.08f)))
            .then(Modifier.pressScale(interaction, 0.94f))
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

/**
 * shadcn switch: a 36x20 track with no shadow, accent when on, hairline border when off, and a
 * thumb that slides. Nothing here scales or bounces, which is what keeps it from reading as M3.
 */
@Composable
fun MeloSwitch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val scheme = MeloTheme.scheme
    val thumbSize = 16.dp
    val trackWidth = 36.dp
    val inset = 2.dp
    val thumbOffset by animateDpAsState(
        targetValue = if (checked) trackWidth - thumbSize - inset else inset,
        animationSpec = tween(160),
        label = "switch-thumb",
    )
    val track by androidx.compose.animation.animateColorAsState(
        targetValue = if (checked) scheme.primary else Color.Transparent,
        animationSpec = tween(160),
        label = "switch-track",
    )
    val thumbColor by androidx.compose.animation.animateColorAsState(
        targetValue = if (checked) scheme.onPrimary else scheme.mutedForeground,
        animationSpec = tween(160),
        label = "switch-thumb-color",
    )
    Box(
        modifier = modifier
            .size(trackWidth, 20.dp)
            .clip(CircleShape)
            .background(track)
            .border(1.dp, if (checked) Color.Transparent else scheme.input, CircleShape)
            .toggleable(
                value = checked,
                enabled = enabled,
                role = Role.Switch,
                onValueChange = onCheckedChange,
            ),
        contentAlignment = Alignment.CenterStart,
    ) {
        Box(
            Modifier
                .offset(x = thumbOffset)
                .size(thumbSize)
                .clip(CircleShape)
                .background(thumbColor),
        )
    }
}

/**
 * shadcn slider: a 4dp rail, a hairline inactive track, and a small thumb. Drag and tap both
 * seek, the gesture writes while dragging and commits once on release (the screens depend on
 * that: seeking on every frame fought the player).
 */
@Composable
fun MeloSlider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    onValueChangeFinished: (() -> Unit)? = null,
    valueRange: ClosedFloatingPointRange<Float> = 0f..1f,
    steps: Int = 0,
    enabled: Boolean = true,
) {
    val scheme = MeloTheme.scheme
    val span = (valueRange.endInclusive - valueRange.start).takeIf { it > 0f } ?: 1f
    val fraction = ((value - valueRange.start) / span).coerceIn(0f, 1f)
    var widthPx by remember { mutableStateOf(1) }
    val thumb = 14.dp
    val density = LocalDensity.current

    fun emit(x: Float) {
        if (!enabled) return
        val raw = valueRange.start + (x / widthPx.toFloat()).coerceIn(0f, 1f) * span
        val snapped = if (steps > 0) {
            val inc = span / (steps + 1)
            (valueRange.start + (((raw - valueRange.start) / inc).roundToInt() * inc))
                .coerceIn(valueRange.start, valueRange.endInclusive)
        } else {
            raw
        }
        onValueChange(snapped)
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(28.dp)
            .onSizeChanged { widthPx = it.width.coerceAtLeast(1) }
            .pointerInput(valueRange, steps, enabled, widthPx) {
                detectTapGestures { offset ->
                    emit(offset.x)
                    onValueChangeFinished?.invoke()
                }
            }
            .pointerInput(valueRange, steps, enabled, widthPx) {
                detectHorizontalDragGestures(
                    onDragStart = { offset -> emit(offset.x) },
                    onHorizontalDrag = { change, _ -> emit(change.position.x) },
                    onDragEnd = { onValueChangeFinished?.invoke() },
                    onDragCancel = { onValueChangeFinished?.invoke() },
                )
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        val rail = if (enabled) scheme.outline else scheme.outline.copy(alpha = 0.5f)
        val active = if (enabled) scheme.primary else scheme.primary.copy(alpha = 0.5f)
        Box(
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(CircleShape)
                .background(rail),
        )
        Box(
            Modifier
                .fillMaxWidth(fraction)
                .height(4.dp)
                .clip(CircleShape)
                .background(active),
        )
        val available = with(density) { widthPx.toDp() } - thumb
        Box(
            Modifier
                .offset(x = (available * fraction).coerceAtLeast(0.dp))
                .size(thumb)
                .clip(CircleShape)
                .background(active),
        )
    }
}

/** shadcn progress bar: 4dp tall, accent fill on the hairline rail. */
@Composable
fun MeloProgress(
    progress: Float,
    modifier: Modifier = Modifier,
    color: Color = MeloTheme.scheme.primary,
) {
    val clamped by animateFloatAsState(progress.coerceIn(0f, 1f), tween(120), label = "progress")
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(4.dp)
            .clip(CircleShape)
            .background(MeloTheme.scheme.outline),
    ) {
        Box(
            Modifier
                .fillMaxWidth(clamped)
                .height(4.dp)
                .clip(CircleShape)
                .background(color),
        )
    }
}

/**
 * Lambda overload, kept because the progress call sites read a value out of a State and the
 * zero-argument form still reads naturally there.
 */
@Composable
fun MeloProgress(
    progress: () -> Float,
    modifier: Modifier = Modifier,
    color: Color = MeloTheme.scheme.primary,
    trackColor: Color = MeloTheme.scheme.outline,
) {
    val clamped by animateFloatAsState(progress().coerceIn(0f, 1f), tween(120), label = "progress")
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(4.dp)
            .clip(CircleShape)
            .background(trackColor),
    ) {
        Box(
            Modifier
                .fillMaxWidth(clamped)
                .height(4.dp)
                .clip(CircleShape)
                .background(color),
        )
    }
}

/** Indeterminate variant, for work with no percentage to show. */
@Composable
fun MeloProgressIndeterminate(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "progress")
    val shift by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1100, easing = LinearEasing)),
        label = "progress-shift",
    )
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(4.dp)
            .clip(CircleShape)
            .background(MeloTheme.scheme.outline),
    ) {
        Box(
            Modifier
                .fillMaxWidth(0.35f)
                .height(4.dp)
                .offset(x = (shift * 300).dp)
                .clip(CircleShape)
                .background(MeloTheme.scheme.primary),
        )
    }
}

/** Spinner as a rotating arc, so it reads as a shadcn loader rather than a Material circle. */
@Composable
fun MeloSpinner(
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 2.dp,
    color: Color = MeloTheme.scheme.primary,
) {
    val transition = rememberInfiniteTransition(label = "spinner")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
        label = "spinner-angle",
    )
    Canvas(modifier.size(18.dp)) {
        val stroke = strokeWidth.toPx()
        val inset = stroke / 2f
        drawArc(
            color = color,
            startAngle = angle,
            sweepAngle = 280f,
            useCenter = false,
            topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
            size = Size(size.width - stroke, size.height - stroke),
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
    }
}

/** A hairline separator. shadcn uses these instead of padding-only grouping. */
@Composable
fun MeloSeparator(modifier: Modifier = Modifier, color: Color = MeloTheme.scheme.border) {
    Box(
        modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(color),
    )
}
