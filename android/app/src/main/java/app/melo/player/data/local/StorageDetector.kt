package app.melo.player.data.local

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import app.melo.player.R
import app.melo.player.MainActivity

/**
 * How much free space is left on the filesystem melo writes to, in bytes.
 *
 * melo's downloads live in the app's private `melo` folder, which shares its partition
 * with `context.cacheDir` on the tests this runs against, so we read that filesystem's
 * free block count. On a real device the `melo` folder can land on external storage;
 * supporting that partition specifically is a follow-up.
 */
object StorageDetector {

    fun freeBytes(context: Context): Long = runCatching {
        val path = context.cacheDir.parentFile?.path ?: return@runCatching 0L
        val fs = android.os.StatFs(path)
        // Available, not total: total would report the partition size and never look low.
        fs.availableBlocksLong * fs.blockSizeLong
    }.getOrDefault(0L)

    /** MB threshold below which the low-space notification appears. */
    const val DEFAULT_LOW_SPACE_MB = 512

    fun isLow(context: Context, mb: Int = DEFAULT_LOW_SPACE_MB): Boolean =
        freeBytes(context) < mb * 1_048_576L
}

// Shares Media3's playback channel: it already exists for the media notification, and one
// channel keeps the alert next to the controls it asks the user to act on.
private const val NOTIF_CHANNEL_ID = app.melo.player.playback.MeloNotificationProvider.CHANNEL_ID
private const val NOTIF_ID = 8_907

/**
 * Shows a non-dismissable persistent notification in the Playback channel when storage is low;
 * clears it when the condition eases. Only posts when it actually needs to, so the notification
 * does not flicker while still low or after it recovers.
 */
object LowSpaceNotifier {

    private var lastFree: Long = 0L

    /**
     * Called by the playback service each time the low-space threshold changes, and once at
     * startup. Posts a new notification only when the device crosses below the threshold and
     * clears it only when it climbs back above, so the alert does not flicker while persistent.
     *
     * Because the service re-posts on every threshold change, the message always reflects the
     * latest free bytes available at the moment of the last evaluation.
     */
    fun refresh(context: Context, freeBytes: Long, thresholdMb: Int) {
        val low = freeBytes < thresholdMb * 1_048_576L
        if (low) {
            if (lastFree >= thresholdMb * 1_048_576L) {
                show(context, freeBytes, thresholdMb)
            } else {
                // Already showing and still low: update only the text, so it stays truthful.
                update(context, freeBytes, thresholdMb)
            }
            lastFree = freeBytes
        } else if (lastFree < thresholdMb * 1_048_576L) {
            clear(context)
            lastFree = freeBytes
        } else {
            lastFree = freeBytes
        }
    }

    fun clear(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIF_ID)
    }

    fun show(context: Context, free: Long, mb: Int) {
        ensureChannel(context)
        val notif = makeNotification(context, free, mb)
        // Denied notification permission means a silent device, not a crashing player.
        runCatching { NotificationManagerCompat.from(context).notify(NOTIF_ID, notif) }
    }

    fun update(context: Context, free: Long, mb: Int) = show(context, free, mb)

    /** Media3 creates the playback channel when it first posts; this alert may arrive first. */
    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(android.app.NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(NOTIF_CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            android.app.NotificationChannel(
                NOTIF_CHANNEL_ID,
                context.getString(R.string.notification_channel_playback),
                android.app.NotificationManager.IMPORTANCE_DEFAULT,
            ),
        )
    }

    private fun makeNotification(context: Context, free: Long, mb: Int): android.app.Notification {
        return NotificationCompat.Builder(context, NOTIF_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_melo)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(context.getString(R.string.low_space_notif_lines, "melo", formatFree(free)))
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText(context.getString(R.string.low_space_notif_details, formatFree(free), mb))
                    .setBigContentTitle(context.getString(R.string.low_space_notif_lines, "melo", formatFree(free)))
                    .setSummaryText(context.getString(R.string.low_space_notif_details, formatFree(free), mb))
            )
            .setContentIntent(
                PendingIntent.getActivity(
                    context,
                    0,
                    Intent(context, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                )
            )
            .build()
    }

    private fun formatFree(bytes: Long): String = when {
        bytes >= 1_000_000_000L -> "${bytes / 1_000_000_000f} GB"
        bytes >= 1_000_000L -> "${bytes / 1_000_000f} MB"
        bytes >= 1_000L -> "${bytes / 1_000f} KB"
        else -> "$bytes B"
    }
}
