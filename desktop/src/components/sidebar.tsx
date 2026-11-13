"use client";

import Link from "@/lib/router";
import { usePathname } from "@/lib/router";
import { Artwork } from "@/components/artwork";
import { IconHome, IconLibrary, IconPlus, IconSearch, IconSettings } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useLibrary } from "@/store/library";
import { useUi } from "@/store/ui";

const navItems = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/search", label: "Search", icon: IconSearch },
  { href: "/library", label: "Library", icon: IconLibrary },
];

export default function Sidebar() {
  const pathname = usePathname();
  const playlists = useLibrary((s) => s.playlists);
  const followed = useLibrary((s) => s.followedArtists);
  const openSheet = useUi((s) => s.openSheet);
  const activeIndex = Math.max(
    0,
    navItems.findIndex(({ href }) => (href === "/" ? pathname === "/" : pathname.startsWith(href))),
  );

  return (
    <aside className="relative z-20 hidden h-full w-[248px] shrink-0 flex-col border-r border-[var(--glass-line)] bg-[var(--glass)] backdrop-blur-2xl backdrop-saturate-150 lg:flex">
      <div className="px-6 pb-6 pt-7">
        <Link href="/" className="group inline-flex items-baseline gap-1.5">
          <span className="font-display text-[26px] leading-none tracking-[-0.055em]">melo</span>
          <span className="mb-[3px] h-1.5 w-1.5 rounded-full bg-accent transition-transform duration-300 group-hover:scale-125" />
        </Link>
      </div>

      {/* One lozenge slides between the tabs instead of each tab flashing
          its own background. Equal item heights make the position pure CSS. */}
      <nav className="nav-glide-wrap relative px-3">
        <span
          aria-hidden
          className="nav-glide"
          style={{
            height: `${100 / navItems.length}%`,
            transform: `translateY(${activeIndex * 100}%)`,
          }}
        />
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press isolate relative z-10 flex items-center gap-3 rounded-full px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                active ? "nav-active text-ink" : "text-muted hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink",
              )}
            >
              <Icon size={19} strokeWidth={active ? 2 : 1.7} filled={href === "/" ? active : undefined} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mb-2 mt-7 flex items-center justify-between px-6">
        <p className="text-[11.5px] font-semibold tracking-[0.01em] text-muted">Playlists</p>
        <button
          onClick={() => openSheet({ type: "createPlaylist" })}
          aria-label="New playlist"
          className="press focus-ring icon-btn h-7 w-7 text-muted hover:bg-[color-mix(in_srgb,var(--ink)_9%,transparent)] hover:text-ink"
        >
          <IconPlus size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {playlists.length === 0 ? (
          <button
            onClick={() => openSheet({ type: "createPlaylist" })}
            className="mt-1 w-full rounded-lg border border-dashed border-line px-3 py-3 text-left text-[12px] leading-relaxed text-muted transition-colors hover:border-white/25 hover:text-ink"
          >
            Create your first playlist. It stays on this device.
          </button>
        ) : (
          playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className={cn(
                "press isolate group flex items-center gap-3 rounded-full px-2 py-1.5",
                pathname === `/playlist/${playlist.id}` ? "nav-active" : "hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
              )}
            >
              <Artwork
                src={playlist.artworkUrl}
                alt={playlist.name}
                className="h-8 w-8 shrink-0"
                rounded="rounded-[5px]"
                iconSize={13}
              />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium">{playlist.name}</p>
                <p className="truncate text-[11px] text-muted">
                  Playlist · {playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"}
                </p>
              </div>
            </Link>
          ))
        )}

        {followed.length > 0 && (
          <>
            <p className="mb-1 mt-6 px-3 text-[11.5px] font-semibold text-muted">Following</p>
            <div className="space-y-0.5">
              {followed.slice(0, 6).map((artist) => (
                <Link
                  key={artist.id}
                  href={`/artist/${encodeURIComponent(artist.id)}`}
                  className="press flex items-center gap-3 rounded-full px-2 py-1.5 hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
                >
                  <Artwork
                    src={artist.artwork}
                    alt={artist.name}
                    className="h-7 w-7 shrink-0"
                    rounded="rounded-full"
                    iconSize={12}
                  />
                  <span className="truncate text-[12.5px]">{artist.name}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-line/70 p-3">
        <Link
          href="/settings"
          className={cn(
            "press isolate flex items-center gap-3 rounded-full px-3 py-2.5 text-[13px] font-medium transition-colors",
            pathname.startsWith("/settings") ? "nav-active text-ink" : "text-muted hover:text-ink",
          )}
        >
          <IconSettings size={19} strokeWidth={pathname.startsWith("/settings") ? 2 : 1.7} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
