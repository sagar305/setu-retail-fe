/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icon.svg", "icon-maskable.svg"],
      manifest: {
        name: "Setu Retail",
        short_name: "Setu Retail",
        description: "Cloud POS for billing, stock and books across every branch.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F2EFE7",
        theme_color: "#26306B",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // The whole app shell (JS, CSS, fonts, icons) is precached so the
        // counter keeps working with no internet. API calls are never cached
        // by the service worker; offline data lives in IndexedDB (Phase 3).
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
