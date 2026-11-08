"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Download, Home, Library, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { useLibrary } from "@/store/library";
import { usePlayer } from "@/store/player";
import { useUi } from "@/store/ui";
import { Artwork } from "@/components/artwork";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Compass },
  { href: "/library", label: "Library", icon: Library },
];

export default function Sidebar() {
  const pathname = usePathname();
  const playlists = useLibrary((s) => s.playlists);
  const followed = useLibrary((s) => s.followedArtists);
  const openSheet = useUi((s) => s.openSheet);
  const queueLength = usePlayer((s) => s.queue.length);
  const { available: canInstall, install } = useInstallPrompt();

  return (
    <aside className="relative z-20 hidden h-full w-[248px] shrink-0 flex-col border-r border-line bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] lg:flex">
      <div className="px-6 pt-7 pb-6">
        <Link href="/" className="group inline-flex items-baseline gap-1.5">
          <span className="font-display text-[26px] leading-none tracking-tight">melo</span>
          <span className="mb-[3px] h-1.5 w-1.5 rounded-full bg-accent transition-transform duration-300 group-hover:scale-125" />
        </Link>
      </div>

      <nav className="px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "press group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium",
                active ? "text-ink" : "text-muted hover:text-ink",
              )}
            >
              {active && (
                <span className="absolute inset-0 rounded-xl bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]" />
              )}
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="relative" />
              <span className="relative">{label}</span>
              {label === "Library" && queueLength > 0 && (
                <span className="relative ml-auto rounded-full bg-[color-mix(in_srgb,var(--ink)_9%,transparent)] px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
                  {queueLength}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-7 flex items-center justify-between px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Playlists</p>
        <button
          onClick={() => openSheet({ type: "createPlaylist" })}
          aria-label="New playlist"
          className="press focus-ring flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] hover:text-ink"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {playlists.length === 0 ? (
          <button
            onClick={() => openSheet({ type: "createPlaylist" })}
            className="mt-1 w-full rounded-xl border border-dashed border-line px-3 py-3 text-left text-[12px] leading-relaxed text-muted transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:text-ink"
          >
            Create your first playlist. It stays on this device.
          </button>
        ) : (
          playlists.map((playlist) => (
            <Link
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className={cn(
                "press group flex items-center gap-3 rounded-xl px-2 py-1.5",
                pathname === `/playlist/${playlist.id}`
                  ? "bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]"
                  : "hover:bg-[color-mix(in_srgb,var(--ink)_4.5%,transparent)]",
              )}
            >
              <Artwork
                src={playlist.artworkUrl}
                alt={playlist.name}
                className="h-8 w-8 shrink-0"
                rounded="rounded-[7px]"
                iconSize={13}
              />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium">{playlist.name}</p>
                <p className="truncate text-[11px] text-muted">
                  {playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"}
                </p>
              </div>
            </Link>
          ))
        )}

        {followed.length > 0 && (
          <>
            <p className="mt-6 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Following</p>
            <div className="mt-2 space-y-0.5">
              {followed.slice(0, 6).map((artist) => (
                <Link
                  key={artist.id}
                  href={`/artist/${encodeURIComponent(artist.id)}`}
                  className="press flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[color-mix(in_srgb,var(--ink)_4.5%,transparent)]"
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

      <div className="border-t border-line p-3">
        {canInstall && (
          <button
            onClick={() => void install()}
            className="press focus-ring mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-accent"
          >
            <Download size={17} /> Install melo
          </button>
        )}
        <Link
          href="/settings"
          className={cn(
            "press flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium",
            pathname.startsWith("/settings") ? "text-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]" : "text-muted hover:text-ink",
          )}
        >
          <Settings2 size={17} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
