# Project instructions

## Every change lands in both apps

melo has two apps and they stay in parity:

- `desktop/` — the Electron desktop app.
- `mobile/` — the Android app (React Native + Expo).

Every product change the user asks for must be made in **both** apps, even when the request names only one. Adapt the same behaviour, copy, and visual language to the other app; platform differences are expected (desktop hover vs. mobile press, desktop window chrome vs. Android navigation), but the feature itself must exist on both sides. Keep the two apps consistent in what they do and what they say.

If something genuinely cannot exist on one platform, say so plainly and explain why in the final message instead of silently shipping it on one side.

When finishing a task, check both apps for the same change, typecheck them, and report what was and was not verified on each.
