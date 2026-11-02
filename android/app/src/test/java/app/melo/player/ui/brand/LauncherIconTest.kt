package app.melo.player.ui.brand

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Icon switching, verified against the real PackageManager (through Robolectric).
 *
 * Android can only change an app's launcher icon by enabling one activity-alias and
 * disabling the rest, so the thing worth testing is exactly that: after a pick, one and
 * only one alias is enabled, and a relaunch does not churn the components.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class LauncherIconTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    private fun state(alias: String): Int = context.packageManager.getComponentEnabledSetting(
        ComponentName(context.packageName, alias),
    )

    private fun enabledIds(): List<String> = IconVariants
        .filter { state(it.launcherAlias) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED }
        .map { it.id }

    @Test
    fun `registry covers every icon the design file lists`() {
        assertThat(IconVariants).hasSize(27)
        assertThat(IconVariants.map { it.id }.toSet()).hasSize(27)
        assertThat(IconVariants.map { it.label }.toSet()).hasSize(27)
        assertThat(IconVariants.map { it.launcherAlias }.toSet()).hasSize(27)
        assertThat(IconVariants.map { it.iconRes }.toSet()).hasSize(27)
        assertThat(IconVariants.map { it.markRes }.toSet()).hasSize(27)
        assertThat(IconVariants.map { it.index }.toSet()).isEqualTo((1..27).toSet())
        assertThat(IconVariants.all { it.background.isNotEmpty() }).isTrue()
    }

    @Test
    fun `every alias is namespaced to this app`() {
        IconVariants.forEach {
            assertThat(it.launcherAlias).startsWith("app.melo.player.launcher.Icon")
        }
        assertThat(DefaultIconId).isEqualTo("default")
    }

    @Test
    fun `choosing a variant enables exactly one launcher alias`() {
        val chosen = iconVariantById("vaporwave")

        assertThat(LauncherIcon.apply(context, chosen.id)).isTrue()
        assertThat(enabledIds()).containsExactly(chosen.id)
        assertThat(LauncherIcon.enabledAlias(context)).isEqualTo(chosen.id)
        assertThat(LauncherIcon.isApplied(context, chosen.id)).isTrue()

        // A relaunch reconciles, it does not reshuffle components.
        assertThat(LauncherIcon.ensureApplied(context, chosen.id)).isFalse()
        assertThat(LauncherIcon.apply(context, chosen.id)).isFalse()

        // Every other variant keeps its alias dark.
        assertThat(IconVariants.count { state(it.launcherAlias) == PackageManager.COMPONENT_ENABLED_STATE_DISABLED })
            .isEqualTo(26)
    }

    @Test
    fun `switching again moves the launcher entry instead of adding one`() {
        LauncherIcon.apply(context, "neon")
        LauncherIcon.apply(context, "gold")

        assertThat(enabledIds()).containsExactly("gold")
        assertThat(LauncherIcon.isApplied(context, "neon")).isFalse()

        LauncherIcon.apply(context, "default")
        assertThat(enabledIds()).containsExactly("default")
    }

    @Test
    fun `an unknown or blank preference falls back to the default icon`() {
        assertThat(iconVariantById("not-a-variant").id).isEqualTo(DefaultIconId)
        assertThat(iconVariantById("").id).isEqualTo(DefaultIconId)
        assertThat(iconVariantById(null).id).isEqualTo(DefaultIconId)

        LauncherIcon.apply(context, "not-a-variant")
        assertThat(enabledIds()).containsExactly(DefaultIconId)
    }
}
