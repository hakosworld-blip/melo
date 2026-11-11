import type { NextConfig } from "next";

// The app ships as the desktop build: Electron bundles this server and runs it
// on a loopback port, so the production output is always self-contained.
const nextConfig: NextConfig = {
  output: "standalone",
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
