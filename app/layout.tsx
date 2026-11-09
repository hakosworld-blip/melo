import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/newsreader";
import "./globals.css";
import AppShell from "@/components/app-shell";
import ThemeApplier from "@/components/theme-applier";
import Toaster from "@/components/toaster";
import PlayerBootstrap from "@/components/player-bootstrap";

export const metadata: Metadata = {
  title: "melo — your music, your way",
  description:
    "melo is a free, ad-free music player with synced lyrics, offline downloads, playlists and deep customisation. No account, no subscription, no tracking.",
  applicationName: "melo",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "melo" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const bootScript = `(function(){try{
  var raw = localStorage.getItem('melo-settings');
  var s = raw ? (JSON.parse(raw).state || {}) : {};
  var root = document.documentElement;
  var mode = s.theme || 'dark';
  var resolved = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : mode;
  root.dataset.theme = resolved;
  root.dataset.font = s.font || 'sans';
  root.dataset.animations = s.animations || 'full';
  root.dataset.motion = s.motion || 'slide';
  var accent = s.accent || 'ink';
  if (accent === 'ink') {
    root.style.setProperty('--accent', 'var(--ink)');
    root.style.setProperty('--accent-ink', 'var(--bg)');
  } else {
    root.style.setProperty('--accent', accent);
    var c = accent.replace('#','');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    var r = parseInt(c.slice(0,2),16)/255, g = parseInt(c.slice(2,4),16)/255, b = parseInt(c.slice(4,6),16)/255;
    var lin = function(v){return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4)};
    var lum = 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
    root.style.setProperty('--accent-ink', lum > 0.5 ? '#141312' : '#fbfaf7');
  }
  if (s.radius !== undefined) root.style.setProperty('--radius', (s.radius|0) + 'px');
  if (s.density) root.style.setProperty('--density', s.density === 'compact' ? '0.82' : s.density === 'spacious' ? '1.22' : '1');
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <ThemeApplier />
        <PlayerBootstrap />
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
