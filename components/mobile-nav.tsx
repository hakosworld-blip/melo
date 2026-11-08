"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, Library, Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Compass },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line chrome pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex h-[60px] max-w-lg items-stretch">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press relative flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors",
                active ? "text-ink" : "text-muted",
              )}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              <span>{label}</span>
              {active && <span className="absolute top-0 h-[2px] w-7 rounded-full bg-accent anim-fade" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
