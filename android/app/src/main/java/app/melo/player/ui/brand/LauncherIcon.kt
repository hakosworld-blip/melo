package app.melo.player.ui.brand

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

/**
 * Runtime launcher-icon switching.
 *
 * Android has no API for repainting the icon of an installed app. The supported approach —
 * the one Discord, Telegram and others use — is to declare one `activity-alias` per icon in
 * the manifest and keep exactly one of them enabled. The launcher shows the icon of the
 * enabled alias, and the rest stay dormant.
 *
 * Every write uses `DONT_KILL_APP` so picking a new icon does not close melo while the
 * player is running. Launchers pick the change up from the package-changed broadcast; a few
 * of them only refresh their grid on their next full redraw.
 */
object LauncherIcon {

    /**
     * Enables [variantId]'s alias and disables the other 26.
     *
     * Returns true when something actually changed, so callers can avoid waking the
     * launcher on every cold start.
     */
    fun apply(context: Context, variantId: String): Boolean {
        val pm = context.packageManager
        val pkg = context.packageName
        val chosen = iconVariantById(variantId)
        var changed = false

        // Enable the wanted alias first: even if the write is interrupted, the app keeps a
        // launcher entry instead of disappearing from the home screen.
        changed = setEnabled(pm, pkg, chosen.launcherAlias, true) || changed
        IconVariants.forEach { variant ->
            if (variant.id != chosen.id) {
                changed = setEnabled(pm, pkg, variant.launcherAlias, false) || changed
            }
        }
        return changed
    }

    /** Applies [variantId] only when the installed component state has drifted from it. */
    fun ensureApplied(context: Context, variantId: String): Boolean =
        if (isApplied(context, variantId)) false else apply(context, variantId)

    /** The variant whose alias is explicitly enabled, or null when nothing was set yet. */
    fun enabledAlias(context: Context): String? {
        val pm = context.packageManager
        val pkg = context.packageName
        return IconVariants.firstOrNull { variant ->
            pm.getComponentEnabledSetting(ComponentName(pkg, variant.launcherAlias)) ==
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        }?.id
    }

    fun isApplied(context: Context, variantId: String): Boolean {
        val chosen = iconVariantById(variantId)
        if (!isEnabled(context, chosen.launcherAlias)) return false
        return IconVariants.none { it.id != chosen.id && isEnabled(context, it.launcherAlias) }
    }

    private fun isEnabled(context: Context, alias: String): Boolean =
        context.packageManager.getComponentEnabledSetting(ComponentName(context.packageName, alias)) ==
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED

    private fun setEnabled(pm: PackageManager, pkg: String, alias: String, enabled: Boolean): Boolean {
        val wanted = if (enabled) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        } else {
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        }
        if (pm.getComponentEnabledSetting(ComponentName(pkg, alias)) == wanted) return false
        return runCatching {
            pm.setComponentEnabledSetting(ComponentName(pkg, alias), wanted, PackageManager.DONT_KILL_APP)
            true
        }.getOrDefault(false)
    }
}
