package app.melo.player.ui.shadcn

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import app.melo.player.ui.theme.MeloTheme
import kotlinx.coroutines.delay

/*
 * shadcn surfaces: cards, dialogs, sheets, menus and inputs.
 *
 * Material expressed elevation with tint and shadow. shadcn expresses it with a hairline border
 * on a flat fill, and the motion follows the same principle: surfaces arrive with a short
 * decelerating fade plus a couple of percent of scale or travel - enough to explain where the
 * surface came from, never enough to wait for.
 */

/** A shadcn card: flat fill, 1dp border, shared radius, 16dp padding. */
@Composable
fun MeloCard(
    modifier: Modifier = Modifier,
    color: Color = MeloTheme.scheme.surface,
    radius: androidx.compose.ui.unit.Dp = MeloTheme.radiusScale.lg,
    borderColor: Color? = MeloTheme.scheme.border,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(radius)
    Column(
        modifier = modifier
            .clip(shape)
            .background(color)
            .then(if (borderColor != null) Modifier.border(1.dp, borderColor, shape) else Modifier)
            .padding(16.dp),
        content = content,
    )
}

/**
 * A centered shadcn dialog. Same slots Material's `AlertDialog` offered (title, text, confirm,
 * dismiss), so the confirmation and picker flows move over unchanged. It fades in and scales up
 * from 96%, which reads as "this came from the control you pressed" rather than a page swap.
 */
@Composable
fun MeloDialog(
    onDismissRequest: () -> Unit,
    title: @Composable () -> Unit = {},
    text: @Composable () -> Unit = {},
    confirmButton: @Composable () -> Unit = {},
    dismissButton: (@Composable () -> Unit)? = null,
) {
    val entered = remember { MutableTransitionState(false) }
    LaunchedEffect(Unit) { entered.targetState = true }
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(usePlatformDefaultWidth = true),
    ) {
        val shape = RoundedCornerShape(MeloTheme.radiusScale.lg)
        AnimatedVisibility(
            visibleState = entered,
            enter = fadeIn(tween(MeloMotion.Standard)) + scaleIn(
                initialScale = 0.96f,
                animationSpec = tween(MeloMotion.Standard, easing = MeloMotion.EaseOut),
            ),
            exit = fadeOut(tween(120)),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(MeloTheme.scheme.popover)
                    .border(1.dp, MeloTheme.scheme.border, shape)
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                CompositionLocalProvider(LocalMeloTextStyle provides MeloTheme.type.titleLarge) {
                    title()
                }
                CompositionLocalProvider(LocalMeloTextStyle provides MeloTheme.type.bodyMedium) {
                    Box(Modifier.padding(top = 2.dp)) { text() }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    dismissButton?.invoke()
                    confirmButton()
                }
            }
        }
    }
}

/**
 * Bottom sheet with the shadcn treatment: hairline border, top-only radius, a 36x4 grabber. It
 * rises the full height of its own content on a quint curve, so the arrival matches the dismiss
 * gesture instead of snapping into place.
 */
@Composable
fun MeloSheet(
    onDismissRequest: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val entered = remember { MutableTransitionState(false) }
    LaunchedEffect(Unit) { entered.targetState = true }
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        val shape = RoundedCornerShape(topStart = MeloTheme.radiusScale.xl, topEnd = MeloTheme.radiusScale.xl)
        AnimatedVisibility(
            visibleState = entered,
            enter = slideInVertically(
                animationSpec = tween(MeloMotion.Slow, easing = MeloMotion.EaseOutQuint),
                initialOffsetY = { it },
            ) + fadeIn(tween(MeloMotion.Fast)),
            exit = fadeOut(tween(120)),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(MeloTheme.scheme.popover)
                    .border(1.dp, MeloTheme.scheme.border, shape)
                    .navigationBarsPadding()
                    .imePadding(),
            ) {
                Box(
                    Modifier.fillMaxWidth().padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        Modifier
                            .size(36.dp, 4.dp)
                            .clip(CircleShape)
                            .background(MeloTheme.scheme.border),
                    )
                }
                content()
            }
        }
    }
}

/**
 * Dropdown menu. Anchored to the composable that emits it - the call sites already wrap the
 * overflow button in a Box - so it needs no anchor reference. It fades in from its own corner
 * at 97%, which visually ties it to the button it belongs to.
 */
@Composable
fun MeloMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    if (!expanded) return
    val entered = remember { MutableTransitionState(false) }
    LaunchedEffect(Unit) { entered.targetState = true }
    Popup(
        alignment = Alignment.TopEnd,
        offset = IntOffset(0, 0),
        onDismissRequest = onDismissRequest,
        properties = PopupProperties(focusable = true),
    ) {
        val shape = RoundedCornerShape(MeloTheme.radiusScale.md)
        AnimatedVisibility(
            visibleState = entered,
            enter = fadeIn(tween(MeloMotion.Fast)) + scaleIn(
                initialScale = 0.97f,
                transformOrigin = TransformOrigin(1f, 0f),
                animationSpec = tween(MeloMotion.Fast, easing = MeloMotion.EaseOut),
            ),
            exit = fadeOut(tween(90)),
        ) {
            Column(
                modifier = modifier
                    .widthIn(min = 180.dp, max = 280.dp)
                    .clip(shape)
                    .background(MeloTheme.scheme.popover)
                    .border(1.dp, MeloTheme.scheme.border, shape)
                    .padding(vertical = 4.dp),
                content = content,
            )
        }
    }
}

/** Menu row with the caller's own text, for rows that need a tint of their own. */
@Composable
fun MeloMenuItem(
    text: @Composable () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 36.dp)
            .background(MeloTheme.scheme.onBackground.copy(alpha = pressAlpha(interaction, 0.06f)))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        text()
    }
}

/** One menu row: 36dp tall, quiet animated press layer, optional destructive tint. */
@Composable
fun MeloMenuItem(
    label: String,
    onClick: () -> Unit,
    destructive: Boolean = false,
    leadingIcon: ImageVector? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val content = if (destructive) MeloTheme.scheme.error else MeloTheme.scheme.popoverForeground
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 36.dp)
            .background(MeloTheme.scheme.onBackground.copy(alpha = pressAlpha(interaction, 0.06f)))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (leadingIcon != null) {
            Icon(leadingIcon, contentDescription = null, tint = content, modifier = Modifier.size(16.dp))
        }
        Text(label, style = MeloTheme.type.bodyMedium, color = content, maxLines = 1)
    }
}

/**
 * shadcn input: a muted fill, 1dp border that becomes the accent ring on focus, 10dp padding.
 * The ring colour is animated, so focus reads as a glow rather than a flicker.
 */
@Composable
fun MeloTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: @Composable (() -> Unit)? = null,
    label: @Composable (() -> Unit)? = null,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    singleLine: Boolean = true,
    enabled: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    shape: Shape = RoundedCornerShape(MeloTheme.radiusScale.md),
) {
    var focused by remember { mutableStateOf(false) }
    val scheme = MeloTheme.scheme
    val interaction = remember { MutableInteractionSource() }
    val border by animateColorAsState(
        targetValue = if (focused) scheme.ring else scheme.input,
        animationSpec = tween(MeloMotion.Fast, easing = MeloMotion.EaseOut),
        label = "field-ring",
    )

    Column(modifier) {
        if (label != null) {
            CompositionLocalProvider(LocalMeloTextStyle provides MeloTheme.type.labelMedium) {
                Box(Modifier.padding(bottom = 6.dp)) { label() }
            }
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = MeloTheme.type.bodyMedium.copy(color = scheme.onBackground),
            singleLine = singleLine,
            enabled = enabled,
            cursorBrush = SolidColor(scheme.primary),
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            interactionSource = interaction,
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focused = it.isFocused },
            decorationBox = { inner ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(scheme.surfaceVariant.copy(alpha = 0.5f))
                        .border(1.dp, border, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    leadingIcon?.invoke()
                    Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty() && placeholder != null) {
                            CompositionLocalProvider(
                                LocalMeloTextStyle provides MeloTheme.type.bodyMedium.copy(
                                    color = scheme.mutedForeground,
                                ),
                            ) {
                                placeholder()
                            }
                        }
                        inner()
                    }
                    trailingIcon?.invoke()
                }
            },
        )
    }
}

/**
 * A minimal scaffold. Material's version brought a SnackbarHost, insets and content colours we
 * do not use; this reserves only the bottom bar's measured height, which is all the navigation
 * host needs to keep content clear of the mini player. That height animates, so list content
 * slides rather than jumping a whole mini player's worth when playback starts.
 */
@Composable
fun MeloScaffold(
    modifier: Modifier = Modifier,
    containerColor: Color = MeloTheme.scheme.background,
    snackbarHost: @Composable () -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit,
) {
    var barHeightPx by remember { mutableIntStateOf(0) }
    val measured = with(LocalDensity.current) { barHeightPx.toDp() }
    val barHeight by animateDpAsState(
        targetValue = measured,
        animationSpec = tween(MeloMotion.Standard, easing = MeloMotion.EaseOut),
        label = "bottom-bar-height",
    )
    Box(modifier.fillMaxSize().background(containerColor)) {
        content(PaddingValues(bottom = barHeight))
        Column(Modifier.align(Alignment.BottomCenter)) {
            Box(Modifier.onSizeChanged { barHeightPx = it.height }) { bottomBar() }
        }
        Box(
            Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = barHeight)
                .padding(horizontal = 12.dp),
        ) {
            snackbarHost()
        }
    }
}

/**
 * Toast state. shadcn's toast is a short-lived bordered card at the bottom, so this replaces
 * `SnackbarHostState` with the same `show(message)` call shape the screens already use.
 */
class MeloToastState {
    var message by mutableStateOf<String?>(null)
        private set
    var token by mutableIntStateOf(0)
        private set

    fun show(text: String) {
        message = text
        token++
    }

    fun dismiss() {
        message = null
    }
}

@Composable
fun MeloToastHost(state: MeloToastState) {
    val message = state.message
    LaunchedEffect(state.token) {
        if (message != null) {
            delay(2600)
            state.dismiss()
        }
    }
    AnimatedVisibility(
        visible = message != null,
        enter = fadeIn(tween(MeloMotion.Fast)) + slideInVertically(
            animationSpec = tween(MeloMotion.Standard, easing = MeloMotion.EaseOut),
            initialOffsetY = { it / 3 },
        ),
        exit = fadeOut(tween(120)),
    ) {
        val shape = RoundedCornerShape(MeloTheme.radiusScale.md)
        Row(
            modifier = Modifier
                .padding(bottom = 6.dp)
                .clip(shape)
                .background(MeloTheme.scheme.popover)
                .border(1.dp, MeloTheme.scheme.border, shape)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                message.orEmpty(),
                style = MeloTheme.type.bodySmall,
                color = MeloTheme.scheme.popoverForeground,
                maxLines = 3,
            )
        }
    }
}
