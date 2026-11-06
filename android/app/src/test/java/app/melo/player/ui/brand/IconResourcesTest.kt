package app.melo.player.ui.brand

import android.content.Context
import androidx.core.content.res.ResourcesCompat
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Every generated icon has to inflate.
 *
 * The launcher renders these drawables in its own process, so a malformed path or a missing
 * gradient attribute would crash the home screen rather than melo. Inflating all 54
 * resources here parses the XML and the path data the same way the framework does.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class IconResourcesTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test
    fun `every launcher icon and mark inflates`() {
        IconVariants.forEach { variant ->
            val icon = ResourcesCompat.getDrawable(context.resources, variant.iconRes, null)
            assertThat(icon).isNotNull()
            assertThat(icon!!.intrinsicWidth).isGreaterThan(0)

            val mark = ResourcesCompat.getDrawable(context.resources, variant.markRes, null)
            assertThat(mark).isNotNull()
            assertThat(mark!!.intrinsicWidth).isEqualTo(108)
            assertThat(mark.intrinsicHeight).isEqualTo(108)
        }
    }

    @Test
    fun `the monochrome silhouette exists for themed icons`() {
        val mono = ResourcesCompat.getDrawable(
            context.resources,
            app.melo.player.R.drawable.ic_mark_mono,
            null,
        )
        assertThat(mono).isNotNull()
        assertThat(mono!!.intrinsicWidth).isEqualTo(108)
    }
}
