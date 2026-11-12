import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  publicDir: "public",
  build: {
    outDir: "dist-renderer",
    emptyOutDir: true,
    // Electron 45 embeds a current Chromium, so no legacy transpilation or
    // polyfills are shipped. Size reporting is off: it only slows the build.
    target: "chrome126",
    reportCompressedSize: false,
  },
  server: {
    port: 5173,
    proxy: {
      // The engine runs separately during development; the packaged app serves
      // the built renderer itself, so both modes share one /api surface.
      "/api": "http://127.0.0.1:3210",
    },
  },
});
