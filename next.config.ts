import type { NextConfig } from "next";

// The desktop build ships the Next server inside Electron, so it needs the
// self-contained standalone output. Web builds are unchanged.
const isDesktopBuild = process.env.MELO_DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isDesktopBuild ? { output: "standalone" as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Artwork is proxied through /api/image so the client never talks to a
    // third-party CDN directly (offline caching + privacy).
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
