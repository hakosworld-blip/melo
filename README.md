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
    stream/[provider]/[id]                     ranged audio proxy (Node http)
    image                                      artwork proxy with host allowlist
    lyrics                                     LRCLIB lookup + manual search
    providers                                  live source availability check
lib/
  provider/audius.ts       Audius provider — keyless, full-length, real metadata
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

### Downloads and offline

Each download stores, per track: audio blob, artwork blob (deduped by URL hash), lyrics with timestamps, and a metadata snapshot (track, artist, collaborators, source, download permission). Records live in `localStorage`, blobs in IndexedDB with exact byte sizes. Downloads resume from a queue with retry; interrupted downloads are marked failed instead of silently disappearing. Deleting a track removes its audio/lyrics/metadata and only removes artwork no other download references. The service worker caches the app shell and artwork so the library, playlists, settings and downloaded music open with no network.

### Privacy

No account, no analytics, no telemetry, no third-party requests from the client (artwork is proxied). Playlists, follows, history, play counts, queue, downloads and settings are local-only.

---

## Honest limitations

- **Native Android packaging is not included here.** This build is an installable PWA: Android gives it a foreground-style media experience through the Media Session API (background audio, lock-screen artwork and transport controls while the browser process is alive). A Media3/ExoPlayer foreground service would require an Android toolchain (SDK, Gradle, device/emulator) that this environment does not have, so no APK was built or tested. The provider/player/download architecture is platform-agnostic and can be wrapped (e.g. Capacitor) with a native media service without touching the UI.
- **YouTube Music cannot stream from this cloud host** because YouTube bot-checks datacenter IPs. The provider is complete; it needs cookies or a residential IP. This is reported in-app rather than silently hidden.
- **Downloads are source-dependent.** Tracks the source marks as downloadable get a real "Download" (permanent offline copy). Other streamable tracks can be saved as a clearly labelled *private offline copy*; melo never claims the artist authorised a download, and nothing from YouTube is downloaded.
- **LRCLIB coverage is community-sourced.** Many independent tracks have no lyrics; the manual search exists for exactly that reason.
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
- **HTTP** — stream proxy served `206` byte ranges and full downloads (`audio/mpeg`, 9.26 MB); artwork proxy serves Audius creator-node hosts with private/loopback and bare-IP targets refused.
- **Build** — `npx tsc --noEmit` and `npm run build` both pass; first-load JS ~125 kB.

Not verified here: real airplane-mode testing (network was blocked at the page instead), OS lock-screen buttons on a physical device, and native Android packaging (see limitations).

## Legal

melo is a client for sources you are authorised to use. It does not bypass DRM, paywalls, gated content or access controls, and it does not claim ownership of any music or lyrics. Lyrics are provided by LRCLIB; catalogue data and streams belong to the selected source. Respect the terms of the sources you configure.

MIT licensed. Built with Next.js, React, Zustand, Tailwind CSS, LRCLIB, Audius and yt-dlp.
