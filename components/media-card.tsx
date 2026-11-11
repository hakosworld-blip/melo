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
    <Link href={href} className={cn("group block min-w-0", className)}>
      <div className="glass-card lift rounded-[16px] p-2">
        <div className={cn("relative overflow-hidden", round ? "rounded-full" : "rounded-[11px]")}>
          <Artwork
            src={artwork}
            alt={title}
            rounded={round ? "rounded-full" : "rounded-[11px]"}
            className="aspect-square w-full transition-transform duration-[700ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.04]"
            iconSize={26}
          />
          {badge && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/85 backdrop-blur-md">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-2.5 truncate px-0.5 text-[13px] font-medium leading-snug">{title}</p>
        {subtitle && <p className="mt-0.5 truncate px-0.5 text-[12px] text-muted">{subtitle}</p>}
      </div>
    </Link>
  );
}

export function ArtistCard({
  href,
  name,
  artwork,
  followers,
  className,
}: {
  href: string;
  name: string;
  artwork?: string;
  followers?: number;
  className?: string;
}) {
  return (
    <MediaCard
      href={href}
      title={name}
      subtitle={followers !== undefined ? `${formatCount(followers)} followers` : undefined}
      artwork={artwork}
      round
      className={className}
    />
  );
}
