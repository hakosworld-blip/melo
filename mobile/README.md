# melo Android

React Native + Expo app for melo.

```bash
npm install
npm run typecheck
npm run prebuild
npm run android:release
```

## Design and lyrics

The app follows the same system as the web build: a near-black listening room (`#0A0A0B`), raised charcoal surfaces, hairline rules, Manrope for everything and tight display tracking. Colour only ever comes from artwork; there are no gradients, shadows or decorative borders.

Now Playing is the dark stage from the phone mock it was designed against: the artwork is drawn full-screen with `blurRadius` behind a scrim, with a large rounded cover, title and `artist · album`, a **Pin** star, a `…` sheet, elapsed/total time, transport, a volume slider and a dock (Lyrics, Repeat, Up next). **Up next** lists the next 15 songs in order, with save-as-playlist and a confirmed clear.

**Lyrics** come from LRCLIB (`src/lyrics.ts`) and are reachable two ways — the bubble on Now Playing, or a long press on any track row. The sheet keeps the sung line crisp while neighbours and the screen edges step back (React Native can't blur text without a native module, so the focus band is per-line opacity plus stacked scrims rather than a Gaussian blur). Synced lines follow playback, pause following for a few seconds while you scroll, and seek when tapped. The credit at the end names the LRCLIB record that was matched, so a mis-matched attachment is never disguised as the playing song. Nothing is cached offline yet.

## Home and recommendations

Home is built in `src/feed.ts` from the plays this phone has recorded (the only history melo keeps). The recent artists and genres seed the **daily mix**; a date-seeded shuffle means the same day returns the same order and tomorrow returns a different one. Genres are real Audius genres with real covers, and each opens a genre screen. **Pinned** songs sit at the top of Home for one-tap playback, and Settings can forget the listening history that seeds it all.

## Playlists and importing

Playlists live on the phone, in a JSON file in the app's private storage: create one in **Library**, add songs from the playlist button on any track row, rename or delete it from the playlist screen. Nothing is uploaded and no account exists.

**Import** (`Library → Import`) accepts a public playlist link:

- **Spotify** is read and matched entirely on the device — the public embed page gives the playlist's name and songs, each song is then searched in Audius with the same scoring rules as the web app (`src/importing.ts`). The playlist is saved with Spotify's name; songs that aren't in the catalogue are listed as skipped instead of being replaced.
- **YouTube Music** needs a melo server on the same network, because reading a YouTube playlist requires `yt-dlp`, which can't run inside the app. Run the web/desktop app on a computer (`npm run dev`), then put that address (e.g. `http://192.168.1.20:3000`) in **Settings → Melo server**. YouTube-imported songs also play through that server, so they only work while it is reachable; Spotify songs never need it.

The manifest allows cleartext HTTP so a plain `http://` server on your LAN works. If you rerun `expo prebuild`, add `android:usesCleartextTraffic="true"` to `<application>` again.

## Release signing

Generate the release keystore (Termux):

```bash
pkg install openjdk coreutils -y

keytool -genkeypair -keystore melo-release.jks -alias melo -keyalg RSA -keysize 2048 -validity 10000 -storepass 'YOUR_STORE_PASSWORD' -keypass 'YOUR_KEY_PASSWORD' -dname "CN=melo, OU=Dev, O=hakosworld, L=City, ST=State, C=US"
```

Export it for GitHub secrets:

```bash
base64 -w 0 melo-release.jks
```

Add these repository secrets:

- `KEYSTORE_BASE64` — the base64 output
- `KEYSTORE_PASSWORD` — store password
- `KEY_PASSWORD` — key password
- `KEY_ALIAS` — `melo`

The Gradle `release` signing config reads `mobile/android/key.properties`. Local development falls back to the debug keystore when that file is absent; the release workflow passes `-PmeloRequireReleaseSigning=true`, so CI aborts with a clear message instead of quietly shipping a debug-signed release. `storeFile` is resolved against both `android/app` and `android/`, so `melo-release.jks` and `app/melo-release.jks` both work.

Version identity lives in `app.json` (`expo.version`, `expo.android.versionCode`); the workflow stamps it from its inputs and Gradle reads it, so the APK reports the version you typed rather than a hardcoded 1.0.0. Before uploading, the workflow runs `apksigner verify --print-certs` and fails if the certificate isn't the keystore's (including the debug key), and it checks the APK's `versionName` matches the input. The asset is published as `melo-<tag>.apk`.

Never commit the keystore or `key.properties`; both are ignored by git. If you rerun `expo prebuild`, reapply the `app.json` version read, the keystore path resolution in `android/app/build.gradle`, and `android:usesCleartextTraffic="true"` in the manifest.
