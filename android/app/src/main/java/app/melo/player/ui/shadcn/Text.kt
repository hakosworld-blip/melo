package app.melo.player.ui.shadcn

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified

/**
 * `Text`, drawn on Compose Foundation instead of Material 3. The parameter list matches what the
 * screens already pass (style, colour, weight, alignment, overflow) so call sites only change
 * which package they import. The starting style is shadcn's body copy at 13sp.
 */
@Composable
fun Text(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    fontSize: TextUnit = TextUnit.Unspecified,
    fontStyle: FontStyle? = null,
    fontWeight: FontWeight? = null,
    fontFamily: FontFamily? = null,
    letterSpacing: TextUnit = TextUnit.Unspecified,
    textDecoration: TextDecoration? = null,
    textAlign: TextAlign? = null,
    lineHeight: TextUnit = TextUnit.Unspecified,
    overflow: TextOverflow = TextOverflow.Clip,
    softWrap: Boolean = true,
    maxLines: Int = Int.MAX_VALUE,
    minLines: Int = 1,
    onTextLayout: ((TextLayoutResult) -> Unit)? = null,
    style: TextStyle = LocalMeloTextStyle.current,
) {
    val resolved = LocalMeloTextStyle.current.merge(style).let { merged ->
        merged.copy(
            color = if (color.isSpecified) color else merged.color,
            fontSize = if (fontSize.isSpecified) fontSize else merged.fontSize,
            fontStyle = fontStyle ?: merged.fontStyle,
            fontWeight = fontWeight ?: merged.fontWeight,
            fontFamily = fontFamily ?: merged.fontFamily,
            letterSpacing = if (letterSpacing.isSpecified) letterSpacing else merged.letterSpacing,
            textDecoration = textDecoration ?: merged.textDecoration,
            textAlign = textAlign ?: merged.textAlign,
            lineHeight = if (lineHeight.isSpecified) lineHeight else merged.lineHeight,
        )
    }
    BasicText(
        text = text,
        modifier = modifier,
        style = resolved,
        onTextLayout = onTextLayout,
        overflow = overflow,
        softWrap = softWrap,
        maxLines = maxLines,
        minLines = minLines,
    )
}

/**
 * `Icon`, drawn with an ImageVector painter. Material's version reads a `LocalContentColor` that
 * no longer exists here, so the tint defaults to the palette's primary text instead.
 */
@Composable
fun Icon(
    imageVector: ImageVector,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tint: Color = Color.Unspecified,
) {
    val resolved = if (tint.isSpecified) tint else LocalMeloScheme.current.onBackground
    Image(
        painter = rememberVectorPainter(imageVector),
        contentDescription = contentDescription,
        modifier = modifier.size(20.dp),
        colorFilter = ColorFilter.tint(resolved),
    )
}
