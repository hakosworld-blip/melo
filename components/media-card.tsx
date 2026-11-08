"use client";

import Link from "next/link";
import { Artwork } from "@/components/artwork";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";

export function MediaCard({
  href,
  title,
  subtitle,
  artwork,
  round,
  badge,
  className,
}: {
  href: string;
  title: string;
  subtitle?: string;
  artwork?: string;
  round?: boolean;
  badge?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group block min-w-0 rounded-[calc(var(--radius)+4px)] p-1.5 transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]", className)}
    >
      <div className="relative">
        <Artwork
          src={artwork}
          alt={title}
          rounded={round ? "rounded-full" : "rounded-[calc(var(--radius)-2px)]"}
          className="aspect-square w-full shadow-[0_16px_38px_-24px_rgba(0,0,0,0.9)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.025]"
          iconSize={26}
        />
        {badge && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85 backdrop-blur">
            {badge}
          </span>
        )}
      </div>
      <div className="px-1 pt-2.5 pb-1">
        <p className="truncate text-[13.5px] font-medium leading-snug">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-[12px] text-muted">{subtitle}</p>}
      </div>
    </Link>
  );
}

export function ArtistCard({
  href,
  name,
  artwork,
  followers,
}: {
  href: string;
  name: string;
  artwork?: string;
  followers?: number;
}) {
  return (
    <MediaCard
      href={href}
      title={name}
      subtitle={followers !== undefined ? `${formatCount(followers)} followers` : undefined}
      artwork={artwork}
      round
    />
  );
}
