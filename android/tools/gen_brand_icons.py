#!/usr/bin/env python3
"""Generate melo's 27 icon variants.

One source of truth: the VARIANTS table below. Running this script writes

  * res/drawable/icon_bg_NN.xml      full-bleed adaptive-icon background
  * res/drawable/ic_mark_NN.xml      the melo mark in that variant's palette
  * res/drawable/ic_mark_mono.xml    silhouette used for themed icons
  * res/mipmap-anydpi-v26/ic_launcher_NN.xml
  * ui/brand/IconVariants.kt         the list the settings screen and the app logo read
  * AndroidManifest.xml              one activity-alias per variant, between the markers

The mark is always melo's own three-bar waveform; the variants change palette and
treatment only, which is why the labels can be descriptive without copying anyone's logo.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]          # android/
RES = ROOT / "app/src/main/res"
BRAND = ROOT / "app/src/main/java/app/melo/player/ui/brand"
MANIFEST = ROOT / "app/src/main/AndroidManifest.xml"

INK = "#0B0B0F"

# id, label, background stops, bar colours, treatment
VARIANTS = [
    ("default",     "Default",     ["#0B0B0F"],                              ["#F4E9D8", "#E6B980", "#F4E9D8"], "solid"),
    ("spotify",     "Spotify",     ["#1ED760"],                              ["#08200F", "#08200F", "#08200F"], "solid"),
    ("discord",     "Discord",     ["#5865F2"],                              ["#FFFFFF", "#FFFFFF", "#FFFFFF"], "solid"),
    ("telegram",    "Telegram",    ["#2AABEE"],                              ["#FFFFFF", "#FFFFFF", "#FFFFFF"], "solid"),
    ("aurora",      "Aurora",      ["#7BE0C8", "#8EA2FF"],                   ["#0B0B0F", "#0B0B0F", "#0B0B0F"], "solid"),
    ("sunset",      "Sunset",      ["#FF9A6B", "#C2417A"],                   ["#1A0E14", "#1A0E14", "#1A0E14"], "solid"),
    ("ocean",       "Ocean",       ["#2E6FA8", "#0E2A44"],                   ["#E9F3FF", "#E9F3FF", "#E9F3FF"], "solid"),
    ("forest",      "Forest",      ["#16301F"],                              ["#A9C08A", "#CFE3B0", "#A9C08A"], "solid"),
    ("berry",       "Berry",       ["#8E2C58", "#3B1030"],                   ["#F7D9E6", "#F7D9E6", "#F7D9E6"], "solid"),
    ("carbon",      "Carbon",      ["#17181C"],                              ["#6E7280", "#9BA0AE", "#6E7280"], "solid"),
    ("pixel",       "Pixel",       ["#101014"],                              ["#FFE9A8", "#FFE9A8", "#FFE9A8"], "pixel"),
    ("scanlines",   "Scanlines",   ["#0E1116"],                              ["#C7F0FF", "#C7F0FF", "#C7F0FF"], "scanlines"),
    ("chrome",      "Chrome",      ["#E8ECF2", "#8A97A8"],                   ["#14161A", "#14161A", "#14161A"], "metal"),
    ("youtube",     "YouTube",     ["#FF0033"],                              ["#FFFFFF", "#FFFFFF", "#FFFFFF"], "solid"),
    ("twitch",      "Twitch",      ["#9146FF"],                              ["#FFFFFF", "#FFFFFF", "#FFFFFF"], "solid"),
    ("instagram",   "Instagram",   ["#F9CE34", "#EE2A7B", "#6228D7"],        ["#FFFFFF", "#FFFFFF", "#FFFFFF"], "solid"),
    ("neon",        "Neon",        ["#05060A"],                              ["#39FFB0", "#39D9FF", "#B06BFF"], "glow"),
    ("lava",        "Lava",        ["#FF6B2C", "#7A0B12"],                   ["#FFD9A0", "#FFD9A0", "#FFD9A0"], "solid"),
    ("candy",       "Candy",       ["#FFB3D1", "#9C7BFF"],                   ["#33143F", "#33143F", "#33143F"], "solid"),
    ("vaporwave",   "Vaporwave",   ["#FF71CE", "#01CDFE"],                   ["#2B0F3A", "#2B0F3A", "#2B0F3A"], "solid"),
    ("midnight",    "Midnight",    ["#0A1024"],                              ["#CDD9FF", "#8FA6FF", "#CDD9FF"], "solid"),
    ("gold",        "Gold",        ["#F7DFA0", "#B8862F"],                   ["#2A1D08", "#2A1D08", "#2A1D08"], "metal"),
    ("rose_gold",   "Rose Gold",   ["#F7C7B8", "#C98A79"],                   ["#3A2320", "#3A2320", "#3A2320"], "metal"),
    ("outline",     "Outline",     ["#0B0B0F"],                              ["#F4E9D8", "#F4E9D8", "#F4E9D8"], "outline"),
    ("glow",        "Glow",        ["#0B0B0F"],                              ["#FFD9A0", "#FFD9A0", "#FFD9A0"], "glow"),
    ("halftone",    "Halftone",    ["#14141B"],                              ["#F4E9D8", "#F4E9D8", "#F4E9D8"], "halftone"),
    ("glitch",      "Glitch",      ["#0B0B0F"],                              ["#F4E9D8", "#F4E9D8", "#F4E9D8"], "glitch"),
]

# Mark geometry on the 108x108 adaptive-icon canvas, inside the 66x66 safe zone.
BARS = ((35.0, 40.0, 68.0), (54.0, 30.0, 78.0), (73.0, 38.0, 64.0))
BAR_W = 9.5


def capsule(cx, top, bottom, width=BAR_W):
    x0, x1 = cx - width / 2, cx + width / 2
    r = width / 2
    return (
        f"M{x0:.2f},{top + r:.2f} "
        f"A{r:.2f},{r:.2f} 0 0 1 {x1:.2f},{top + r:.2f} "
        f"L{x1:.2f},{bottom - r:.2f} "
        f"A{r:.2f},{r:.2f} 0 0 1 {x0:.2f},{bottom - r:.2f} Z"
    )


def path(d, colour, alpha=None):
    a = f'\n        android:fillAlpha="{alpha}"' if alpha is not None else ""
    return f'    <path\n        android:fillColor="{colour}"{a}\n        android:pathData="{d}" />'


def gradient_path(d, stops, x1, y1, x2, y2):
    items = "\n".join(
        f'                <item android:color="{c}" android:offset="{i / (len(stops) - 1):.2f}" />'
        for i, c in enumerate(stops)
    )
    return (
        f'    <path android:pathData="{d}">\n'
        f'        <aapt:attr name="android:fillColor">\n'
        f'            <gradient\n'
        f'                android:type="linear"\n'
        f'                android:startX="{x1}" android:startY="{y1}"\n'
        f'                android:endX="{x2}" android:endY="{y2}">\n'
        f"{items}\n"
        f"            </gradient>\n"
        f"        </aapt:attr>\n"
        f"    </path>"
    )


def vector(paths, needs_aapt=False):
    ns = ' xmlns:aapt="http://schemas.android.com/aapt"' if needs_aapt else ""
    body = "\n".join(paths)
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        f'<vector xmlns:android="http://schemas.android.com/apk/res/android"{ns}\n'
        '    android:width="108dp"\n'
        '    android:height="108dp"\n'
        '    android:viewportWidth="108"\n'
        '    android:viewportHeight="108">\n'
        f"{body}\n"
        "</vector>\n"
    )


def background_drawable(stops):
    rect = "M0,0 H108 V108 H0 Z"
    if len(stops) == 1:
        return vector([path(rect, stops[0])]), False
    return vector([gradient_path(rect, stops, 0, 0, 108, 108)], needs_aapt=True), True


def mark_paths(bars, style):
    """bars: three colours, one per bar."""
    out = []
    if style in ("glow", "neon"):
        for scale, alpha in ((1.9, 0.06), (1.55, 0.10), (1.22, 0.16)):
            for (cx, top, bottom), colour in zip(BARS, bars):
                mid = (top + bottom) / 2
                h = (bottom - top) * scale
                w = BAR_W * scale
                out.append(path(capsule(cx, mid - h / 2, mid + h / 2, w), colour, f"{alpha:.2f}"))

    if style == "glitch":
        shifted = ((BARS[0][0] - 3.4, BARS[0][1], BARS[0][2]),
                   (BARS[1][0] - 3.4, BARS[1][1], BARS[1][2]),
                   (BARS[2][0] - 3.4, BARS[2][1], BARS[2][2]))
        for (cx, top, bottom) in shifted:
            out.append(path(capsule(cx, top, bottom), "#00E5FF", "0.55"))
        shifted = ((BARS[0][0] + 3.4, BARS[0][1], BARS[0][2]),
                   (BARS[1][0] + 3.4, BARS[1][1], BARS[1][2]),
                   (BARS[2][0] + 3.4, BARS[2][1], BARS[2][2]))
        for (cx, top, bottom) in shifted:
            out.append(path(capsule(cx, top, bottom), "#FF2D95", "0.55"))

    if style == "outline":
        for (cx, top, bottom), colour in zip(BARS, bars):
            out.append(path(capsule(cx, top, bottom), colour, "0.14"))
            out.append(path(capsule(cx, top, bottom, BAR_W - 2.6), colour))

    elif style == "pixel":
        for (cx, top, bottom), colour in zip(BARS, bars):
            block = 8.0
            count = max(3, int(round((bottom - top) / block)))
            step = (bottom - top) / count
            for i in range(count):
                w = BAR_W * (1.0 if i % 2 == 0 else 0.62)
                out.append(
                    path(f"M{cx - w / 2:.2f},{top + i * step:.2f} H{cx + w / 2:.2f} "
                         f"V{top + (i + 1) * step - 0.9:.2f} H{cx - w / 2:.2f} Z", colour)
                )

    elif style == "scanlines":
        for (cx, top, bottom), colour in zip(BARS, bars):
            out.append(path(capsule(cx, top, bottom), colour))
        y = 28.0
        while y < 80:
            out.append(path(f"M24,{y:.2f} H84 V{y + 1.4:.2f} H24 Z", "#0E1116", "0.65"))
            y += 5

    elif style == "halftone":
        for (cx, top, bottom), colour in zip(BARS, bars):
            y = top + 2.6
            while y < bottom - 1.6:
                x = cx - BAR_W / 2 + 2.0
                while x < cx + BAR_W / 2:
                    out.append(path(f"M{x:.2f},{y:.2f} m-1.7,0 a1.7,1.7 0 1,0 3.4,0 a1.7,1.7 0 1,0 -3.4,0", colour))
                    x += 4.4
                y += 4.4

    elif style == "metal":
        for (cx, top, bottom), colour in zip(BARS, bars):
            out.append(gradient_path(capsule(cx, top, bottom), ["#2A2E36", "#8C97A6", "#20232A"],
                                      cx - BAR_W / 2, top, cx + BAR_W / 2, bottom))
    else:
        for (cx, top, bottom), colour in zip(BARS, bars):
            out.append(path(capsule(cx, top, bottom), colour))

    return out


def kotlin_registry():
    rows = []
    for i, (vid, label, bg, bars, style) in enumerate(VARIANTS, start=1):
        colours = ", ".join(f"Color(0xFF{c.lstrip('#')})" for c in bg)
        rows.append(
            "    IconVariant(\n"
            f'        id = "{vid}",\n'
            f'        label = "{label}",\n'
            f"        index = {i},\n"
            f'        launcherAlias = "app.melo.player.launcher.Icon{i:02d}",\n'
            f"        iconRes = R.mipmap.ic_launcher_{i:02d},\n"
            f"        markRes = R.drawable.ic_mark_{i:02d},\n"
            f"        background = listOf({colours}),\n"
            f"        barColor = Color(0xFF{bars[0].lstrip('#')}),\n"
            f'        style = "{style}",\n'
            "    ),"
        )
    return (
        "// Generated by android/tools/gen_brand_icons.py — edit the generator, not this file.\n"
        "package app.melo.player.ui.brand\n"
        "\n"
        "import androidx.compose.runtime.Immutable\n"
        "import androidx.compose.ui.graphics.Color\n"
        "import app.melo.player.R\n"
        "\n"
        "/**\n"
        " * One selectable look for the launcher icon and the in-app mark.\n"
        " *\n"
        " * [launcherAlias] is the manifest activity-alias that has to be enabled for the\n"
        " * launcher to show this icon; Android has no runtime API to repaint an icon, so one\n"
        " * alias per variant is the supported approach.\n"
        " */\n"
        "@Immutable\n"
        "data class IconVariant(\n"
        "    val id: String,\n"
        "    val label: String,\n"
        "    val index: Int,\n"
        "    val launcherAlias: String,\n"
        "    val iconRes: Int,\n"
        "    val markRes: Int,\n"
        "    val background: List<Color>,\n"
        "    val barColor: Color,\n"
        "    val style: String,\n"
        ")\n"
        "\n"
        f"val IconVariants: List<IconVariant> = listOf(\n{chr(10).join(rows)}\n)\n"
        "\n"
        "fun iconVariantById(id: String?): IconVariant =\n"
        "    IconVariants.firstOrNull { it.id == id } ?: IconVariants.first()\n"
        "\n"
        "val DefaultIconId: String = IconVariants.first().id\n"
    )


def manifest_block():
    out = [
        "        <!-- Generated by android/tools/gen_brand_icons.py: one alias per icon so the",
        "             enabled alias decides which icon the launcher shows. Exactly one is",
        "             enabled at a time; the settings screen flips them at runtime. -->",
    ]
    for i, (vid, label, bg, bars, style) in enumerate(VARIANTS, start=1):
        enabled = "true" if i == 1 else "false"
        out.append(
            "        <activity-alias\n"
            f'            android:name=".launcher.Icon{i:02d}"\n'
            '            android:targetActivity=".MainActivity"\n'
            '            android:exported="true"\n'
            f'            android:enabled="{enabled}"\n'
            f'            android:icon="@mipmap/ic_launcher_{i:02d}"\n'
            f'            android:roundIcon="@mipmap/ic_launcher_{i:02d}"\n'
            '            android:label="@string/app_name">\n'
            "            <intent-filter>\n"
            '                <action android:name="android.intent.action.MAIN" />\n'
            '                <category android:name="android.intent.category.LAUNCHER" />\n'
            "            </intent-filter>\n"
            "        </activity-alias>"
        )
    return "\n".join(out)


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main():
    (RES / "drawable").mkdir(parents=True, exist_ok=True)
    (RES / "mipmap-anydpi-v26").mkdir(parents=True, exist_ok=True)
    BRAND.mkdir(parents=True, exist_ok=True)

    for i, (vid, label, bg, bars, style) in enumerate(VARIANTS, start=1):
        bg_xml, needs_aapt = background_drawable(bg)
        write(RES / f"drawable/icon_bg_{i:02d}.xml", bg_xml)

        mark = mark_paths(bars, style)
        uses_aapt = needs_aapt or any("<aapt:attr" in p for p in mark)
        write(RES / f"drawable/ic_mark_{i:02d}.xml", vector(mark, needs_aapt=uses_aapt))

        write(
            RES / f"mipmap-anydpi-v26/ic_launcher_{i:02d}.xml",
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            f'    <background android:drawable="@drawable/icon_bg_{i:02d}" />\n'
            f'    <foreground android:drawable="@drawable/ic_mark_{i:02d}" />\n'
            '    <monochrome android:drawable="@drawable/ic_mark_mono" />\n'
            "</adaptive-icon>\n",
        )

    write(
        RES / "drawable/ic_mark_mono.xml",
        vector([path(capsule(cx, top, bottom), "#FFFFFF") for (cx, top, bottom) in BARS]),
    )

    write(BRAND / "IconVariants.kt", kotlin_registry())

    text = MANIFEST.read_text(encoding="utf-8")
    pattern = re.compile(r"(<!-- icon-aliases:start -->)(.*?)(<!-- icon-aliases:end -->)", re.S)
    if not pattern.search(text):
        sys.exit("manifest is missing the icon-aliases markers")
    text = pattern.sub(lambda m: f"{m.group(1)}\n{manifest_block()}\n        {m.group(3)}", text)
    MANIFEST.write_text(text, encoding="utf-8")

    print(f"wrote {len(VARIANTS)} variants")


if __name__ == "__main__":
    main()
