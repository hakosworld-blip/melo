# melo 🎧

**Your music, your way.** A free, ad-free, account-free music player with synced lyrics, offline downloads, deep customisation and real streaming — built as an installable app.

```
No subscriptions. No ads. No mandatory accounts. No artificial restrictions.
```

---

## What melo is

melo is a full music application, not a mock-up. It streams real catalogue audio, searches a live catalogue, shows real artist bios and play counts when the source provides them, syncs lyrics from LRCLIB, stores downloads on-device (audio + artwork + metadata + lyrics), and works without a connection once you've downloaded tracks.

It runs as a **Next.js app / installable PWA**. On Android it installs to the home screen and keeps playing in the background with lock-screen controls through the platform Media Session (title, artist, artwork, play/pause, next/previous, seek).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm start            # production server
```

Optional, only for the YouTube Music source (see below):

```bash
# yt-dlp is resolved from bin/yt-dlp, YTDLP_PATH, or your PATH
bin/yt-dlp --version
```

### Android app

The native Android app lives in [`mobile/`](mobile) as a React Native + Expo app. It uses Expo Audio for background playback and lock-screen controls, and streams from Audius directly on device.

It also has local playlists (`Library`) with create, rename, delete, add-from-any-song and play-all, plus the same playlist import: Spotify is read and matched on the phone, while YouTube playlists go through an optional melo server on the same network, since reading YouTube needs `yt-dlp` (that server also serves the audio for YouTube-imported songs). Details in [`mobile/README.md`](mobile/README.md).

```bash
cd mobile
npm install
npm run typecheck
npm run prebuild   # regenerate android/ after app.json changes
npm run android:release
```

GitHub Actions workflow (`.github/workflows/build-release-apk.yml`) typechecks the mobile app, builds the signed release APK with Gradle, and publishes it as a GitHub Release with a configurable tag, version, and pre-release flag.

### Desktop app (Linux + Windows 10/11)

The desktop build lives in [`desktop/`](desktop) and packages this same Next.js app with Electron — same UI, same local API routes, no accounts or telemetry. The Next server is bundled inside the installer and started on a loopback port at launch.

```bash
cd desktop
npm ci
npm run build:linux     # AppImage
npm run build:windows   # NSIS installer (use Windows or CI)
```

`.github/workflows/build-release-desktop.yml` builds both platforms and attaches them to the GitHub Release for the same tag. If that release already exists — for example the one the APK workflow created — the desktop files are added to its existing assets instead of creating a second release, so mobile and desktop ship as one version.

---

## Architecture

```
app/
  page.tsx                 Home — trending, genres, recently played, local top tracks
  search/                  Live catalogue search (songs / artists / albums)
  library/                 Playlists, followed artists, history, downloads
  artist/[id]              Real artist profile: bio, top songs by play count, releases
  album/[id]               Album / playlist detail
  playlist/[id]            Local playlist editing, reordering, offline saving
  settings/                Appearance, backgrounds, player, lyrics, source, storage
  api/
    home | search | track | artist | album     provider-backed JSON
    import/spotify | import/youtube | import/match   playlist import + song matching
    stream/[provider]/[id]                     ranged audio proxy (Node http)
    image                                      artwork proxy with host allowlist
    lyrics                                     LRCLIB lookup + manual search
    providers                                  live source availability check
lib/
  provider/audius.ts       Audius provider — keyless, full-length, real metadata
  spotify.ts               Public Spotify playlist reader (name + tracks, no key)
  youtube-import.ts        YouTube Music playlist reader — exact videos, no matching
  match-import.ts          Scores an imported song against catalogue search results
  provider/youtube.ts      YouTube Music provider — yt-dlp (metadata + streaming only)
  lyrics.ts                LRC parsing, matching, caching (LRCLIB)
  player-engine.ts         HTMLAudioElement, Media Session, artwork metadata
  storage.ts               IndexedDB assets, byte accounting, deletion
store/
  player.ts                Queue, repeat/shuffle, persistence, resume position
  downloads.ts             Download queue, progress, retry, dedupe, refcount deletion
  library.ts               Playlists, follows, history, local play counts
  settings.ts              Every customisation, persisted to localStorage
components/                Now Playing, lyrics, queue, sheets, rows, cards, UI primitives
public/sw.js               Offline app shell + artwork cache (audio stays in IndexedDB)
```

### Provider layer

Every source implements one interface (`lib/types.ts` → `MusicProvider`): `home`, `search`, `track`, `artist`, `album`, `streamUrl`, `availability`. The UI, queue, player, downloads and offline library only see normalised `Track`/`Artist`/`Album` shapes, so a new source is one file plus a registry entry — no UI changes.

**Audius** (default, works out of the box) — public keyless API. Full-length streams, real play counts, bios, albums, playlists, collaborators and an explicit `is_downloadable` flag per track. Stream-gated tracks are never played and never offered.

**YouTube Music** — implemented through `yt-dlp` (yt-dlp-nightly) for search, YouTube Music metadata (track/artist/album/year), channel-based artist pages sorted by real view counts, and audio resolved on demand. Downloads are disabled for this source because YouTube does not authorise downloading. YouTube blocks datacenter IPs ("confirm you're not a bot"), so on a cloud host the provider reports that clearly and the UI suggests Audius.

Enable YouTube locally:

```bash
# make yt-dlp available (either)
sudo apt install yt-dlp            # or: pipx install yt-dlp
export YTDLP_PATH=/path/to/yt-dlp
export YTDLP_JS_RUNTIME=node       # yt-dlp needs a JS runtime in 2026

# optional, if the host is challenged
export YTDLP_COOKIES=/path/to/cookies.txt
# or YTDLP_COOKIES_FROM_BROWSER=chrome
```

The UI's **Settings → Music source → Test sources** performs a real search *and* a real stream resolution and reports exactly what each source can do on the current host.

### Playback

- One `HTMLAudioElement` owned by `lib/player-engine.ts`, outside React, so navigation and UI unmounts never interrupt audio.
- Queue, index, repeat mode, shuffle, volume and resume position persist (`localStorage`).
- `navigator.mediaSession` publishes metadata (with proxied artwork), play/pause/next/previous/seek handlers and position state for lock-screen and OS media controls.
- The seek bar updates from an external progress store at animation rate without re-rendering the tree.
- Repeat off/all/one, shuffle (with original order restored when disabled), play next, add to queue, reorder, remove, jump-to-track.

### Lyrics

LRCLIB is queried exact-first, then by a scored search (title/artist/duration). Only real timestamps are treated as synced; unsynchronised lyrics are labelled "Not time-synced". Synced lyrics highlight the current line, auto-scroll, support tap-to-seek, and respect font size, alignment, highlight style and auto-scroll preferences. If nothing matches, **Search lyrics** lets you pick the correct LRCLIB record and attach it; attached and downloaded lyrics are cached in IndexedDB and work offline.

### Importing a playlist

Library → Playlists → **Import** takes a public Spotify or YouTube Music playlist link and saves it here with the same name. Re-importing a playlist whose name already exists adds the missing songs to that playlist instead of creating a duplicate. Nothing is posted to either service and no credentials are used.

**Spotify** (`open.spotify.com/playlist/…`, the embed link, or a `spotify:playlist:` URI) is read from its public page — no account, no API key. Each song is then matched, catalogue first (Audius) and then, if the catalogue has no confident match and the YouTube Music source works on this host, against YouTube search. Matching is deterministic and explainable (`lib/match-import.ts`): normalised title, artist overlap and duration agreement are scored. YouTube candidates are held to a stricter rule — exact (or prefix) title match and a duration within 20 s when both sides report one — because YouTube search returns every upload that mentions a song. Songs that match nothing are reported by name rather than replaced with a wrong track.

**YouTube Music** (`music.youtube.com/playlist?list=…`, any `youtube.com` playlist, a watch link with `list=`, or a bare playlist id) imports the exact videos in the playlist, so there is no matching step and nothing is lost in translation. These songs stream through the YouTube Music source and cannot be downloaded, and reading the playlist needs the same working `yt-dlp` the provider already needs.

Limits, said out loud: Spotify's public page exposes at most the first 100 songs of a playlist, YouTube playlists are read up to 200 songs, and the Spotify → YouTube fallback is skipped automatically on hosts where YouTube can't play (a cloud IP that gets bot-checked), so those imports report fewer matches instead of adding songs that won't play.

### Downloads and offline

Each download stores, per track: audio blob, artwork blob (deduped by URL hash), lyrics with timestamps, and a metadata snapshot (track, artist, collaborators, source, download permission). Records live in `localStorage`, blobs in IndexedDB with exact byte sizes. Downloads resume from a queue with retry; interrupted downloads are marked failed instead of silently disappearing. Deleting a track removes its audio/lyrics/metadata and only removes artwork no other download references. The service worker caches the app shell and artwork so the library, playlists, settings and downloaded music open with no network.

### Privacy

No account, no analytics, no telemetry, no third-party requests from the client (artwork is proxied). Playlists, follows, history, play counts, queue, downloads and settings are local-only.

---

## Honest limitations

- **The web build is still an installable PWA; the native Android app is separate.** The repo now includes a React Native + Expo Android app under `mobile/` with a Gradle-signed APK workflow. The web build keeps its Media Session playback experience; the mobile build uses Expo Audio with background playback and lock-screen controls. The mobile app is an MVP of the web app: home, search, queue, Now Playing, local playlists, playlist import and source checks are implemented; downloaded/offline files, lyrics, artist/album detail pages, and the full settings surface are still to be ported.
- **YouTube import on Android needs a melo server.** Reading a YouTube playlist requires yt-dlp, which can't run inside the app, so the YouTube path (and playback of the songs it imports) uses an optional melo server address set in Settings. Spotify import, playlists and search work with no server at all.
- **YouTube Music cannot stream from this cloud host** because YouTube bot-checks datacenter IPs. The provider is complete; it needs cookies or a residential IP. This is reported in-app rather than silently hidden.
- **Downloads are source-dependent.** Tracks the source marks as downloadable get a real "Download" (permanent offline copy). Other streamable tracks can be saved as a clearly labelled *private offline copy*; melo never claims the artist authorised a download, and nothing from YouTube is downloaded.
- **LRCLIB coverage is community-sourced.** Many independent tracks have no lyrics; the manual search exists for exactly that reason.
- **Playlist import is best-effort, not a mirror.** Only public playlists can be read. Spotify's public page exposes at most 100 songs and YouTube playlists are read up to 200. Spotify songs come from Audius where possible and from YouTube Music otherwise, so mainstream playlists depend on the YouTube source working on this host; where it doesn't, those songs are reported as not found instead of importing covers or remixes. YouTube-imported songs are stream-only.
- Audius does not expose an album catalogue for every artist, so some profiles show no albums — melo shows nothing rather than inventing releases.

## Testing performed

Exercised in a real browser against the live catalogue, not just rendered:

- **Playback** — clicking a track starts audio; the timeline advanced (7.04% → 7.35%) and Now Playing showed `0:43 / -9:01`. Media Session metadata (title, artist, proxied artwork, play state) is published for lock-screen controls.
- **Controls** — repeat cycles off → all → one → off, shuffle toggles on/off, next/previous, seek and queue reorder are wired to the real audio element.
- **Lyrics** — a track with no LRCLIB record honestly reports "No lyrics found"; the manual search returned real synced matches for "Get Lucky / Daft Punk" and attaches them to the track.
- **Download** — a downloadable Audius track stored 9,256,477 B of audio + 79,380 B artwork + 931 B metadata in IndexedDB, deduped by artwork hash.
- **Offline** — with every `/api/*` request rejected and `navigator.onLine = false`, the downloaded track still played from its stored blob (57.8% → 58.6%).
- **Playlists** — saving the queue created a 24-track playlist that survived a full reload (sidebar + library).
- **Storage** — panel reported 8.8 MB in melo (audio/metadata split). Deleting one download confirmed first, then removed the record and *all* its IndexedDB assets, returning storage to 0 B.
- **Customisation** — accent and light/dark theme applied instantly and persisted across reload.
- **Search** — live query returned real tracks, artists and result counts.
- **Playlist import** — `open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M` returned its real name and 50 songs in 0.29 s; 8 of 8 catalogue songs re-imported at score 100. A 12-song mainstream batch matched 0/12 against Audius (correctly: those tracks aren't there) and 12/12 through the YouTube fallback with the right artists and durations within a second of Spotify's — e.g. "Housewife / Tate McRae" 209 s → 210 s, "Patient Zero / Taylor Swift" 226 s → 229 s. The fallback's scoring was verified here with the availability gate temporarily bypassed, because this cloud host cannot resolve YouTube audio.
- **YouTube Music import** — `music.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI` imported 182 unique songs in 3.0 s with correct names, channels, durations and thumbnails ("BELLAKEO" / Peso Pluma / 235 s), reading the playlist's own order.
- **Android import logic** — the phone's pure import module was compiled and run against the live services: link detection and id parsing for Spotify links/URIs, the real embed page parsed into "Today's Top Hits" with 50 songs, and 6 of 6 catalogue songs matched back to the exact same track, with a mainstream control query returning nothing. The app's screens and storage were typechecked but not run on a device or emulator here.
- **HTTP** — stream proxy served `206` byte ranges and full downloads (`audio/mpeg`, 9.26 MB); artwork proxy serves Audius creator-node hosts with private/loopback and bare-IP targets refused.
- **Build** — `npx tsc --noEmit` and `npm run build` both pass; first-load JS ~125 kB.

Not verified here: real airplane-mode testing (network was blocked at the page instead), OS lock-screen buttons on a physical device, and the signed Android APK on a real device. The mobile app typecheck and Expo config pass; Gradle signing happens in GitHub Actions with the secrets described in `mobile/android/key.properties.example`.

For the desktop app, `MELO_DESKTOP_BUILD=1 npm run build`, `scripts/prepare-desktop.mjs`, and `electron-builder --linux` were all run successfully, producing a 160 MB AppImage whose bundled Next server answered `200` on `/`, `/_next/static/css/*`, and `/api/home`. The Electron window itself could not be launched in this container (missing Chromium system libraries and no root to install them), and the Windows installer was not built here.

## Legal

melo is a client for sources you are authorised to use. It does not bypass DRM, paywalls, gated content or access controls, and it does not claim ownership of any music or lyrics. Lyrics are provided by LRCLIB; catalogue data and streams belong to the selected source. Respect the terms of the sources you configure.

MIT licensed. Built with Next.js, React, Zustand, Tailwind CSS, React Native, Expo, LRCLIB, Audius and yt-dlp.
