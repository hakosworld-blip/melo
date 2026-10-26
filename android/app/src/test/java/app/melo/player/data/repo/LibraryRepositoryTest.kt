package app.melo.player.data.repo

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import app.melo.player.data.db.MeloDatabase
import app.melo.player.data.model.Source
import app.melo.player.data.model.Track
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Exercises the real Room-backed library: playlists, favourites, history and follows.
 * Runs on the JVM through Robolectric so it needs no emulator.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class LibraryRepositoryTest {

    private lateinit var db: MeloDatabase
    private lateinit var repo: LibraryRepository

    private fun track(id: String, title: String = "Track $id", artist: String = "Artist") = Track(
        id = id,
        title = title,
        artist = artist,
        album = "Album",
        durationMs = 200_000,
        artwork = "https://example.com/$id.jpg",
        source = Source.YOUTUBE,
    )

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, MeloDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        repo = LibraryRepository(db.libraryDao())
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun `playlist is created and tracks keep their order`() = runTest {
        val id = repo.createPlaylist("Morning")
        repo.addToPlaylist(id, track("a"))
        repo.addToPlaylist(id, track("b"))
        repo.addToPlaylist(id, track("c"))

        val tracks = repo.playlistTracks(id).first()
        assertThat(tracks.map { it.id }).containsExactly("a", "b", "c").inOrder()

        val playlist = repo.playlists.first().first { it.id == id }
        assertThat(playlist.name).isEqualTo("Morning")
        assertThat(playlist.trackCount).isEqualTo(3)
    }

    @Test
    fun `adding the same track twice is ignored`() = runTest {
        val id = repo.createPlaylist("Dupes")
        assertThat(repo.addToPlaylist(id, track("a"))).isTrue()
        assertThat(repo.addToPlaylist(id, track("a"))).isFalse()
        assertThat(repo.playlistTracks(id).first()).hasSize(1)
    }

    @Test
    fun `reorder and remove keep positions dense`() = runTest {
        val id = repo.createPlaylist("Reorder")
        listOf("a", "b", "c").forEach { repo.addToPlaylist(id, track(it)) }

        repo.moveTrack(id, 0, 2)
        assertThat(repo.playlistTracks(id).first().map { it.id }).containsExactly("b", "c", "a").inOrder()

        repo.removeFromPlaylist(id, track("c").key)
        assertThat(repo.playlistTracks(id).first().map { it.id }).containsExactly("b", "a").inOrder()
    }

    @Test
    fun `deleting a playlist removes its tracks only`() = runTest {
        val first = repo.createPlaylist("One")
        val second = repo.createPlaylist("Two")
        repo.addToPlaylist(first, track("a"))
        repo.addToPlaylist(second, track("b"))

        repo.deletePlaylist(first)

        assertThat(repo.playlists.first().map { it.name }).containsExactly("Two")
        assertThat(repo.playlistTracks(second).first().map { it.id }).containsExactly("b")
    }

    @Test
    fun `cover follows the first track`() = runTest {
        val id = repo.createPlaylist("Cover")
        repo.addToPlaylist(id, track("x"))
        val playlist = repo.playlists.first().first { it.id == id }
        assertThat(playlist.coverArtwork).isEqualTo("https://example.com/x.jpg")
    }

    @Test
    fun `favourite toggling is idempotent`() = runTest {
        val t = track("fav")
        assertThat(repo.toggleFavorite(t)).isTrue()
        assertThat(repo.isFavorite(t.key)).isTrue()
        assertThat(repo.toggleFavorite(t)).isFalse()
        assertThat(repo.isFavorite(t.key)).isFalse()
        assertThat(repo.favorites.first()).isEmpty()
    }

    @Test
    fun `history counts repeats and surfaces most played`() = runTest {
        val a = track("a")
        val b = track("b")
        repo.recordPlay(a)
        repo.recordPlay(a)
        repo.recordPlay(b)

        val mostPlayed = repo.mostPlayed.first()
        assertThat(mostPlayed.first().first.id).isEqualTo("a")
        assertThat(mostPlayed.first().second).isEqualTo(2)

        assertThat(repo.lastPlayed()?.id).isEqualTo("b")
    }

    @Test
    fun `clearing history keeps favourites`() = runTest {
        repo.recordPlay(track("a"))
        repo.toggleFavorite(track("a"))
        repo.clearHistory()

        assertThat(repo.history.first()).isEmpty()
        assertThat(repo.favorites.first()).hasSize(1)
    }

    @Test
    fun `following artists toggles and persists`() = runTest {
        assertThat(repo.toggleFollow("Radiohead", "art.jpg", 1_000_000)).isTrue()
        assertThat(repo.isFollowing("Radiohead").first()).isTrue()
        assertThat(repo.followedArtists.first().map { it.name }).containsExactly("Radiohead")

        assertThat(repo.toggleFollow("radiohead")).isFalse()
        assertThat(repo.isFollowing("Radiohead").first()).isFalse()
    }

    @Test
    fun `recent searches are deduplicated by query`() = runTest {
        repo.addSearch("daft punk")
        repo.addSearch("daft punk")
        repo.addSearch("x") // too short, ignored
        assertThat(repo.recentSearches.first()).containsExactly("daft punk")
    }

    @Test
    fun `track key distinguishes sources`() = runTest {
        val yt = track("same").copy(source = Source.YOUTUBE)
        val sc = track("same").copy(source = Source.SOUNDCLOUD)
        assertThat(yt.key).isNotEqualTo(sc.key)

        val id = repo.createPlaylist("Mixed")
        repo.addToPlaylist(id, yt)
        repo.addToPlaylist(id, sc)
        assertThat(repo.playlistTracks(id).first()).hasSize(2)
    }

    @Test
    fun `clearAllLibraryData wipes everything`() = runTest {
        val id = repo.createPlaylist("Gone")
        repo.addToPlaylist(id, track("a"))
        repo.toggleFavorite(track("a"))
        repo.toggleFollow("Artist")
        repo.recordPlay(track("a"))

        repo.clearAllLibraryData()

        assertThat(repo.playlists.first()).isEmpty()
        assertThat(repo.favorites.first()).isEmpty()
        assertThat(repo.followedArtists.first()).isEmpty()
        assertThat(repo.history.first()).isEmpty()
    }
}
