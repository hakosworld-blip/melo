# melo desktop

Electron wrapper around the melo Next.js app, packaged for Linux and Windows 10/11.

The app runs the same UI and the same local API routes as the web build: the Next
standalone server is bundled inside the installer and started on a free loopback
port when melo opens. Nothing is served to the network, and no account or
telemetry is involved.

## Build locally

```bash
# from the repository root
npm ci
MELO_DESKTOP_BUILD=1 npm run build     # Windows PowerShell: $env:MELO_DESKTOP_BUILD="1"
node scripts/prepare-desktop.mjs

cd desktop
npm ci
npm run build:linux     # AppImage -> desktop/dist
npm run build:windows   # NSIS installer -> desktop/dist (best run on Windows or CI)
```

`npm start` in `desktop/` launches the packaged entry point against the bundle in
`../.next/standalone`, which is handy while working on the shell.

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

The Windows installer is unsigned, so Windows SmartScreen will show an
"unknown publisher" prompt until the build is signed with a code-signing
certificate. The Linux AppImage is unsigned in the same way; most desktops run it
directly after `chmod +x`.
