"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { cn } from "@/lib/cn";

const gradients = [
  "linear-gradient(138deg,#3a2f28,#221f1d 55%,#151414)",
  "linear-gradient(138deg,#2c3338,#1e2226 55%,#141517)",
  "linear-gradient(138deg,#3b2b34,#241d22 55%,#151314)",
  "linear-gradient(138deg,#27332e,#1c2320 55%,#131514)",
  "linear-gradient(138deg,#34302a,#232019 55%,#141312)",
];

function gradientFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return gradients[hash % gradients.length];
}

export function Artwork({
  src,
  alt,
  className,
  rounded = "rounded-[var(--radius)]",
  iconSize = 22,
  eager,
}: {
  src?: string;
  alt: string;
  className?: string;
  rounded?: string;
  iconSize?: number;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const proxied = src
    ? src.startsWith("blob:") || src.startsWith("data:")
      ? src
      : `/api/image?src=${encodeURIComponent(src)}`
    : null;

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-surface2",
        rounded,
        className,
      )}
      style={{ backgroundImage: !proxied || failed ? gradientFor(alt) : undefined }}
    >
      {proxied && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- artwork is proxied and cache-friendly
        <img
          key={proxied}
          src={proxied}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full object-cover text-transparent transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      {(!proxied || failed) && (
        <div className="absolute inset-0 flex items-center justify-center text-ink/25">
          <Music2 size={iconSize} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
