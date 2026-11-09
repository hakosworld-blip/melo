"use client";

import { useEffect } from "react";
import { useSettings, resolveTheme } from "@/store/settings";

/**
 * Applies the whole customisation surface to the document as CSS variables.
 * Runs on every settings change, so everything updates live with no restart.
 */
export default function ThemeApplier() {
  const settings = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = resolveTheme(settings.theme);
      root.dataset.font = settings.font;
      root.dataset.animations = settings.animations;
      root.dataset.motion = settings.motion;
      // "ink" is the monochrome default: the CTA is the text colour, so it
      // inverts with the theme instead of pinning one brand colour.
      const monochrome = settings.accent === "ink";
      root.style.setProperty("--accent", monochrome ? "var(--ink)" : settings.accent);
      root.style.setProperty("--accent-ink", monochrome ? "var(--bg)" : contrastInk(settings.accent));
      root.style.setProperty("--radius", `${settings.radius}px`);
      root.style.setProperty(
        "--density",
        settings.density === "compact" ? "0.82" : settings.density === "spacious" ? "1.22" : "1",
      );
    };
    apply();

    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const listener = () => apply();
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [
    settings.theme,
    settings.font,
    settings.animations,
    settings.motion,
    settings.accent,
    settings.radius,
    settings.density,
  ]);

  return null;
}

/** Readable ink for any accent colour. */
export function contrastInk(hex: string): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.5 ? "#16130c" : "#fbfaf7";
}
