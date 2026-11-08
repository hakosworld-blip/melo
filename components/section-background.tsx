"use client";

import { useEffect, useState } from "react";
import { KEYS, getAssetUrl } from "@/lib/storage";
import { useSettings, type SectionKey } from "@/store/settings";

/**
 * Renders the user's background for a section: solid colour, gradient, an
 * uploaded image, or the current artwork — with blur/opacity/brightness/
 * saturation controls applied. Everything is a single composited layer so it
 * stays cheap during scrolling.
 */
export default function SectionBackground({
  section,
  artworkUrl,
  className = "",
}: {
  section: SectionKey;
  artworkUrl?: string;
  className?: string;
}) {
  const config = useSettings((s) => s.backgrounds[section]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (config.type === "image" && config.imageKey) {
      getAssetUrl(KEYS.background(config.imageKey)).then((url) => {
        if (!cancelled) setImageUrl(url);
      });
    } else {
      setImageUrl(null);
    }
    return () => {
      cancelled = true;
    };
  }, [config.type, config.imageKey]);

  const source = config.type === "artwork" ? artworkUrl : config.type === "image" ? imageUrl : undefined;
  const filter = `blur(${config.blur}px) brightness(${config.brightness}) saturate(${config.saturation})`;

  return (
    <div className={`section-bg ${className}`} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            config.type === "gradient"
              ? `linear-gradient(${config.gradientAngle}deg, ${config.gradientFrom}, ${config.gradientTo})`
              : config.type === "color"
                ? config.color
                : "var(--bg)",
        }}
      />
      {source && (
        <div
          className="section-bg-layer anim-fade"
          style={{
            backgroundImage: `url("/api/image?src=${encodeURIComponent(source)}")`,
            filter,
            transform: `scale(${1 + Math.min(config.blur, 100) / 500})`,
          }}
        />
      )}
      {config.type !== "color" && config.overlay > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, rgba(3,3,4,${Math.min(0.55, config.overlay / 160)}), rgba(3,3,4,${Math.min(0.94, config.overlay / 100)}))`,
          }}
        />
      )}
    </div>
  );
}
