// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  // Off for visual runs: its badge shows a live timing and overlaps the UI in baselines.
  devtools: { enabled: !process.env.VISUAL_REGRESSION },
  modules: ["@nuxt/ui", "@nuxtjs/i18n", "@vite-pwa/nuxt"],
  css: ["~/assets/css/main.css"],
  // Self-hosted by @nuxt/fonts at build time, so the PWA keeps them offline.
  fonts: {
    families: [
      { name: "Bricolage Grotesque", provider: "google", weights: [500, 600, 700, 800] },
      { name: "Instrument Sans", provider: "google", weights: [400, 500, 600, 700] },
    ],
  },
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "Sudoku Pro",
      short_name: "Sudoku Pro",
      description:
        "Sudoku with a step-by-step hint analyzer, daily puzzles, and a technique academy.",
      lang: "en",
      theme_color: "#0d141b",
      background_color: "#0d141b",
      display: "standalone",
      orientation: "portrait",
      categories: ["games", "puzzle", "education"],
      icons: [
        { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      // Cache the SPA shell + assets for full offline play. The game is
      // entirely client-side (ssr: false), so no network is needed once loaded.
      globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
      navigateFallback: "/",
      cleanupOutdatedCaches: true,
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },
  i18n: {
    locales: [
      { code: "en", language: "en-US", file: "en.json", name: "English" },
      { code: "rs", language: "sr-Latn-RS", file: "rs.json", name: "Srpski" },
    ],
    defaultLocale: "en",
    langDir: "locales/",
    strategy: "no_prefix",
  },
  ssr: false,
  app: {
    // Set via NUXT_APP_BASE_URL in CI (e.g. /sudoku/ for GitHub Pages).
    // Falls back to '/' for local dev.
    baseURL: process.env.NUXT_APP_BASE_URL ?? "/",
    head: {
      meta: [
        { name: "theme-color", content: "#0d141b" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "Sudoku Pro" },
      ],
      link: [
        // ssr:false doesn't auto-inject the manifest link, so add it explicitly
        // (relative href so it respects app.baseURL on sub-path deploys).
        { rel: "manifest", href: "manifest.webmanifest" },
        { rel: "icon", type: "image/x-icon", href: "favicon.ico" },
        { rel: "apple-touch-icon", href: "apple-touch-icon.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;900&display=swap",
        },
      ],
    },
  },
});
