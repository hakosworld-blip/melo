# melo Android

React Native + Expo app for melo.

```bash
npm install
npm run typecheck
npm run prebuild
npm run android:release
```

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

The Gradle `release` signing config reads `mobile/android/key.properties`. Local development falls back to the debug keystore when that file is absent. Never commit the keystore or `key.properties`.
