"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { IconHome, IconLibrary, IconSearch, IconSettings } from "@/components/ui/icons";
import { useUi } from "@/store/ui";

const items = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/library", label: "Library", icon: IconLibrary },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

/**
 * Two pieces of chrome, exactly as the phone app draws them: a floating pill
 * for the three destinations and a separate search button beside it. Detached
 * from the screen edge so content scrolls underneath rather than stopping at a
 * hard bar.
 */
export default function MobileNav() {
  const pathname = usePathname();
  const searchActive = pathname.startsWith("/search") || pathname.startsWith("/genre");
  const sheetOpen = useUi((s) => s.sheet !== null);

  return (
    <nav className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),8px)] transition-opacity duration-200 lg:hidden",
        sheetOpen ? "invisible opacity-0" : "opacity-100",
      )}>
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2">
        <div className="glass-strong pill-nav flex h-[58px] flex-1 items-center gap-0.5 px-1.5">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press focus-ring isolate relative flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-full text-[10.5px] font-medium tracking-[0.01em] transition-colors",
                  active ? "nav-active text-ink" : "text-ink/65 hover:text-ink",
                )}
              >
                <Icon size={21} strokeWidth={active ? 2 : 1.75} filled={href === "/" ? active : undefined} />
                <span className="leading-none">{label}</span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/search"
          aria-label="Search"
          aria-current={searchActive ? "page" : undefined}
          className={cn(
            "glass-strong pill-nav press focus-ring icon-btn h-[58px] w-[58px] shrink-0",
            searchActive ? "text-ink" : "text-ink/80 hover:text-ink",
          )}
        >
          <IconSearch size={22} strokeWidth={searchActive ? 2 : 1.75} />
        </Link>
      </div>
    </nav>
  );
}
