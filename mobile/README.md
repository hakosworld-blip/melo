# melo Android

React Native + Expo app for melo.

```bash
npm install
npm run typecheck
npm run prebuild
npm run android:release
```

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
