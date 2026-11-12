# melo desktop

A standalone Electron app for Linux and Windows 10/11. It has **no web
framework at runtime**: the UI is a Vite + React renderer, and the app ships its
own local engine — a small `node:http` server — which serves both the built
renderer and every `/api` route on a loopback port.

Nothing is exposed to the network by default, and there is no account or
telemetry.

## Layout

```
main.js              Electron entry: starts the engine, then opens the window
engine/index.ts      Local engine: /api routes + static renderer, on node:http
src/                 Renderer
  main.tsx           Entry and route table
  lib/router.tsx     Link / usePathname / useRouter / useParams
  lib/               providers, feed, lyrics, spotify, imports, storage, player engine
  store/             player, downloads, library, settings (zustand)
  pages/             Home, Search, Library, Settings, artist, album, playlist, genre
  components/        Now Playing, lyrics, queue, sheets, rows, cards, UI primitives
index.html           Vite entry (carries the theme boot script)
vite.config.ts       @ alias, Tailwind plugin, dev API proxy
```

## Build locally

```bash
cd desktop
npm ci
npm run dev            # renderer only, hot reload, /api proxied to :3210
npm run build          # engine bundle + renderer build
npm start              # build, then launch the Electron window
npm run build:linux    # AppImage -> desktop/dist
npm run build:windows  # NSIS installer -> desktop/dist (Windows or CI)
```

To work on the UI with hot reload, run the engine in one terminal and Vite in
another:

```bash
# terminal 1 — the engine the renderer talks to
npm run build:engine
PORT=3210 node engine/server.cjs

# terminal 2 — the renderer
npm run dev
```

Then `MELO_DEV_URL=http://localhost:5173 npx electron .` if you want the Electron
window pointed at the dev server instead of the built shell.

## Letting a phone reach it

The Android app can use this engine for YouTube playlist import and playback.
The engine binds loopback by default, so opt in explicitly:

```bash
npm run build:engine
MELO_ENGINE_HOST=0.0.0.0 PORT=3000 node engine/server.cjs
```

Then put `http://<your-computer-LAN-ip>:3000` in the phone's **Settings → Melo
server**. Only do this on a network you trust.

## Releases

`.github/workflows/build-release-desktop.yml` builds both platforms and attaches
the results to a GitHub Release:

- **Manual run** — Actions → *Build · Release Desktop* → provide a tag such as
  `v1.0.0`.
- **Automatic** — it also runs when a release is published by a person in the
  GitHub UI.
- **Existing tag** — if the release for that tag already exists, the new
  `*.AppImage` and `*.exe` files are uploaded into its existing assets
  (`gh release upload --clobber`) instead of creating a second release.

One GitHub quirk matters here: events caused by a workflow's own `GITHUB_TOKEN`
do not start other workflows. So when the APK workflow creates a new release,
this workflow does not start by itself — run it once with the same tag and the
desktop files are appended to that release.

Artifacts per platform:

| Platform | File |
| --- | --- |
| Linux x64 | `melo-<version>-linux-x64.AppImage` |
| Windows 10/11 x64 | `melo-<version>-windows-x64-setup.exe` |

The installers are unsigned, so Windows SmartScreen shows an "unknown publisher"
prompt until the build is signed with a code-signing certificate. The Linux
AppImage is unsigned in the same way; most desktops run it after `chmod +x`.

## Bundled tools

`bin/yt-dlp` is packaged next to the engine (`extraResources`) and resolved
relative to the engine's working directory. If it is absent, the YouTube Music
source reports that clearly instead of failing silently. There is no second source to switch to.
