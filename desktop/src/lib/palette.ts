"use client";

import { useEffect, useState } from "react";

/**
 * Tiny average-colour extractor for the ambient Now Playing glow.
 * Runs on a 32×32 canvas of the proxied artwork — cheap and cached.
 */
const cache = new Map<string, string | null>();

export function useArtworkAccent(url: string | undefined): string | null {
  const [accent, setAccent] = useState<string | null>(() => (url ? cache.get(url) ?? null : null));

  useEffect(() => {
    if (!url) {
      setAccent(null);
      return;
    }
    if (cache.has(url)) {
      setAccent(cache.get(url) ?? null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/api/image?src=${encodeURIComponent(url)}`;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no 2d");
        ctx.drawImage(img, 0, 0, 32, 32);
        const { data } = ctx.getImageData(0, 0, 32, 32);
        let r = 0;
        let g = 0;
        let b = 0;
        let weight = 0;
        for (let i = 0; i < data.length; i += 4) {
          const rr = data[i];
          const gg = data[i + 1];
          const bb = data[i + 2];
          const max = Math.max(rr, gg, bb);
          const min = Math.min(rr, gg, bb);
          const saturation = max === 0 ? 0 : (max - min) / max;
          // Favour colourful, mid-bright pixels over black/white noise.
          const w = 0.2 + saturation * 1.4;
          r += rr * w;
          g += gg * w;
          b += bb * w;
          weight += w;
        }
        if (!weight) throw new Error("empty");
        const colour = [r / weight, g / weight, b / weight]
          .map((c) => Math.round(Math.min(235, Math.max(28, c))))
          .join(", ");
        cache.set(url, colour);
        if (!cancelled) setAccent(colour);
      } catch {
        cache.set(url, null);
        if (!cancelled) setAccent(null);
      }
    };
    img.onerror = () => {
      cache.set(url, null);
      if (!cancelled) setAccent(null);
    };
    return () => {
      cancelled = true;
    };
  }, [url]);

  return accent;
}
