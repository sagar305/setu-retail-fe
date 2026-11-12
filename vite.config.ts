/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * A production build must know where the API is: without VITE_API_URL the app
 * would quietly call http://localhost:4000. Use "/api" (the vercel.json
 * rewrite) or the API's https:// address.
 */
function checkApiUrl(mode: string, command: string) {
  if (command !== "build" || mode !== "production") return;
  const url = loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL ?? "";
  if (!url) throw new Error("VITE_API_URL is not set. In Vercel set it to /api (Settings → Environment Variables), then redeploy.");
  const ok = /^\/[a-z0-9-]+$/.test(url) || /^https:\/\/[^/]+\/?$/.test(url) || /^http:\/\/localhost(:\d+)?$/.test(url);
  if (!ok) throw new Error(`VITE_API_URL "${url}" should be /api or an https:// address with no path.`);
}

/**
 * Says in the build log whether this is the demo build, so a demo deploy whose
 * VITE_DEMO_MODE didn't reach the build is easy to spot (VITE_* values are
 * baked in at build time: changing one needs a redeploy).
 */
function reportDemo(mode: string, command: string) {
  if (command !== "build") return;
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  const on = /^(true|1|yes|on)$/i.test(clean(env.VITE_DEMO_MODE));
  if (!on) {
    console.log(`Demo build: OFF${env.VITE_DEMO_MODE ? ` (VITE_DEMO_MODE is "${env.VITE_DEMO_MODE}", not true)` : ""}`);
    return;
  }
  const logins = clean(env.VITE_DEMO_LOGIN).split(";").filter((x) => x.includes("|")).length;
  console.log(`Demo build: ON · ${logins} demo login${logins === 1 ? "" : "s"} · sign-ups go to ${clean(env.VITE_PRODUCTION_APP_URL) || "https://app.retail-pos.setutechnology.com"}`);
  if (!logins) console.warn("Demo build: VITE_DEMO_LOGIN is empty, so the sign-in page shows no demo logins.");
}

export default defineConfig(({ mode, command }) => (checkApiUrl(mode, command), reportDemo(mode, command), {
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
        // /api/* is the API (vercel.json rewrite), never the app shell.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  // Same as the vercel.json rewrite, for running with VITE_API_URL=/api locally.
  server: { proxy: { "/api": { target: "http://localhost:4000", rewrite: (p: string) => p.replace(/^\/api/, "") } } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
}));
