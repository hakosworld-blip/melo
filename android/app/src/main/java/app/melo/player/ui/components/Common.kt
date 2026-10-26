package app.melo.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Explicit
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.SearchOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.melo.player.data.model.Track
import app.melo.player.ui.theme.LocalMeloColors
import app.melo.player.ui.theme.MeloTheme
import app.melo.player.ui.theme.Spacing
import coil.compose.AsyncImage
import coil.request.ImageRequest

/** Artwork with a calm placeholder, used for tracks, albums and artists. */
@Composable
fun MeloArt(
    url: String?,
    modifier: Modifier = Modifier,
    corner: Dp = MeloTheme.radius,
    circular: Boolean = false,
    contentDescription: String? = null,
) {
    val shape = if (circular) CircleShape else RoundedCornerShape(corner)
    val colors = LocalMeloColors.current
    val context = LocalContext.current
    val placeholder = Brush.linearGradient(
        listOf(
            colors.surfaceElevated,
            MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
        ),
    )

    Box(
        modifier = modifier
            .clip(shape)
            .background(placeholder),
        contentAlignment = Alignment.Center,
    ) {
        if (url.isNullOrBlank()) {
            Icon(
                Icons.Rounded.GraphicEq,
                contentDescription = null,
                tint = colors.textSecondary.copy(alpha = 0.7f),
                modifier = Modifier.size(26.dp),
            )
        } else {
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(url)
                    .crossfade(220)
                    .build(),
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    subtitle: String? = null,
    onAction: (() -> Unit)? = null,
    actionLabel: String = "See all",
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screenH, vertical = Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.titleLarge,
                color = LocalMeloColors.current.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = LocalMeloColors.current.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (onAction != null) {
            Text(
                actionLabel,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClick = onAction)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
}

/** One song row: art, title, artist, optional trailing content. */
@Composable
fun TrackRow(
    track: Track,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onLongClick: (() -> Unit)? = null,
    isActive: Boolean = false,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = LocalMeloColors.current
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = Spacing.screenH, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            Box(Modifier.width(28.dp), contentAlignment = Alignment.Center) { leading() }
        }
        MeloArt(
            url = track.artwork,
            modifier = Modifier.size(48.dp),
            corner = 12.dp,
            contentDescription = "${track.title} artwork",
        )
        Spacer(Modifier.width(Spacing.md))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    track.title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Medium,
                    color = if (isActive) MaterialTheme.colorScheme.primary else colors.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (track.explicit) {
                    Spacer(Modifier.width(4.dp))
                    Icon(
                        Icons.Rounded.Explicit,
                        contentDescription = "Explicit",
                        tint = colors.textSecondary,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
            Text(
                buildString {
                    append(track.artist)
                    if (track.album.isNotBlank()) append(" · ").append(track.album)
                },
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (trailing != null) trailing() else {
            Text(
                formatDuration(track.durationMs),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
        }
    }
}

@Composable
fun OverflowButton(description: String = "More options", onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(40.dp)) {
        Icon(
            Icons.Rounded.MoreVert,
            contentDescription = description,
            tint = LocalMeloColors.current.textSecondary,
        )
    }
}

@Composable
fun EmptyState(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector = Icons.Rounded.SearchOff,
    action: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(Spacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = LocalMeloColors.current.textSecondary.copy(alpha = 0.6f),
            modifier = Modifier.size(34.dp),
        )
        Text(
            title,
            style = MaterialTheme.typography.titleMedium,
            color = LocalMeloColors.current.textPrimary,
            textAlign = TextAlign.Center,
        )
        Text(
            message,
            style = MaterialTheme.typography.bodySmall,
            color = LocalMeloColors.current.textSecondary,
            textAlign = TextAlign.Center,
        )
        if (action != null) {
            Spacer(Modifier.height(Spacing.xs))
            action()
        }
    }
}

@Composable
fun OfflineState(onRetry: () -> Unit) {
    EmptyState(
        title = "You're offline",
        message = "Downloads and your library still work. Connect to refresh the catalog.",
        icon = Icons.Rounded.CloudOff,
        action = { MeloTextButton("Try again", onRetry) },
    )
}

@Composable
fun MeloTextButton(label: String, onClick: () -> Unit) {
    Text(
        label,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 9.dp),
    )
}

@Composable
fun LoadingRow(label: String = "Loading") {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(Spacing.xxl),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(
            strokeWidth = 2.dp,
            modifier = Modifier
                .size(18.dp)
                .semantics { contentDescription = label },
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.width(Spacing.md))
        Text(label, style = MaterialTheme.typography.bodySmall, color = LocalMeloColors.current.textSecondary)
    }
}

@Composable
fun TagChip(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = LocalMeloColors.current.textSecondary,
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(LocalMeloColors.current.surfaceElevated)
            .padding(horizontal = 7.dp, vertical = 3.dp),
    )
}

fun formatDuration(ms: Long): String {
    if (ms <= 0) return ""
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

fun formatCount(value: Long): String = when {
    value <= 0 -> ""
    value >= 1_000_000_000 -> "%.1fB".format(value / 1_000_000_000.0)
    value >= 1_000_000 -> "%.1fM".format(value / 1_000_000.0)
    value >= 1_000 -> "%.1fK".format(value / 1_000.0)
    else -> value.toString()
}

fun formatBytes(bytes: Long): String = when {
    bytes >= 1L shl 30 -> "%.1f GB".format(bytes / (1L shl 30).toDouble())
    bytes >= 1L shl 20 -> "%.0f MB".format(bytes / (1L shl 20).toDouble())
    bytes >= 1L shl 10 -> "%.0f KB".format(bytes / (1L shl 10).toDouble())
    else -> "$bytes B"
}

/** Soft vertical fade used behind long lists so the mini player never fights content. */
@Composable
fun BottomFade(modifier: Modifier = Modifier) {
    val bg = MaterialTheme.colorScheme.background
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(28.dp)
            .background(Brush.verticalGradient(listOf(Color.Transparent, bg))),
    )
}
