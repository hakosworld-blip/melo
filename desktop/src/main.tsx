import { Suspense, lazy, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/newsreader";
import "./styles.css";

import AppShell from "@/components/app-shell";
import PlayerBootstrap from "@/components/player-bootstrap";
import ThemeApplier from "@/components/theme-applier";
import Toaster from "@/components/toaster";
import { RouteContext, usePathname } from "@/lib/router";
import HomePage from "@/pages/HomePage";

// Home ships with the shell; every other view is its own chunk, so opening the
// app parses the home screen only and a page downloads when it is first opened.
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const LibraryPage = lazy(() => import("@/pages/LibraryPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const GenrePage = lazy(() => import("@/pages/GenrePage"));
const ArtistPage = lazy(() => import("@/pages/ArtistPage"));
const AlbumPage = lazy(() => import("@/pages/AlbumPage"));
const PlaylistPage = lazy(() => import("@/pages/PlaylistPage"));

/**
 * Route table.
 *
 * The old Next app resolved these from the filesystem; the desktop build keeps
 * the same URLs so bookmarks and deep links inside the window still work, but
 * resolves them here instead.
 */
function resolve(pathname: string): { params: Record<string, string>; element: React.ReactNode } {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0) return { params: {}, element: <HomePage /> };

  const [head, param] = parts;
  if (parts.length === 1) {
    if (head === "search") return { params: {}, element: <SearchPage /> };
    if (head === "library") return { params: {}, element: <LibraryPage /> };
    if (head === "settings") return { params: {}, element: <SettingsPage /> };
  }

  if (parts.length === 2 && param) {
    if (head === "genre") return { params: { genre: decodeURIComponent(param) }, element: <GenrePage /> };
    if (head === "artist") return { params: { id: decodeURIComponent(param) }, element: <ArtistPage /> };
    if (head === "album") return { params: { id: decodeURIComponent(param) }, element: <AlbumPage /> };
    if (head === "playlist") return { params: { id: decodeURIComponent(param) }, element: <PlaylistPage /> };
  }

  return { params: {}, element: <NotFound /> };
}

function NotFound() {
  return (
    <div className="page-pad flex min-h-full flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-[13px] text-muted">That page isn’t part of melo.</p>
      <a href="/" className="text-[13px] text-ink underline decoration-line underline-offset-4">
        Back to Home
      </a>
    </div>
  );
}

function Routes() {
  const pathname = usePathname();
  const { params, element } = useMemo(() => resolve(pathname), [pathname]);
  return (
    <RouteContext.Provider value={{ params }}>
      <Suspense
        fallback={
          <div className="page-pad flex flex-col gap-4 pt-10">
            <div className="skeleton h-9 w-48" />
            <div className="skeleton h-4 w-64" />
            <div className="skeleton mt-4 h-24 w-full" />
          </div>
        }
      >
        {element}
      </Suspense>
    </RouteContext.Provider>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <>
    <ThemeApplier />
    <PlayerBootstrap />
    <AppShell>
      <Routes />
    </AppShell>
    <Toaster />
  </>,
);
