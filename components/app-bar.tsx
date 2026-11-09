"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconChevronLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * App toolbar. Sits inside the scrolling surface, gains its hairline only once
 * content moves beneath it — the way a native title bar behaves, not a website
 * header that always wears a border.
 */
export default function AppBar({
  title,
  subtitle,
  backHref,
  actions,
  className,
}: {
  title?: string;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.body) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      node = node.parentElement;
    }
    const target: HTMLElement | Window = node ?? window;
    const read = () => (target === window ? window.scrollY : (target as HTMLElement).scrollTop);
    const onScroll = () => setScrolled(read() > 4);
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={ref}
      data-scrolled={scrolled}
      className={cn("appbar chrome sticky top-0 z-30 pt-[env(safe-area-inset-top)]", className)}
    >
      <div className="flex min-h-[58px] items-center gap-2 pb-1.5 pt-1">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="press focus-ring -ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink"
          >
            <IconChevronLeft size={20} />
          </Link>
        )}
        {title ? (
          <div className="min-w-0 flex-1">              <h1 className="font-display truncate text-[20px] leading-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-muted">{subtitle}</p>}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </div>
  );
}
