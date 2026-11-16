// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  // Off for visual runs: its badge shows a live timing and overlaps the UI in baselines.
  devtools: { enabled: !process.env.VISUAL_REGRESSION },
  modules: ["@nuxt/ui", "@nuxtjs/i18n", "@vite-pwa/nuxt"],
  css: ["~/assets/css/main.css"],
  // Generate theme CSS only for the Nuxt UI components the app uses: 260 KB of CSS otherwise.
  ui: { experimental: { componentDetection: true } },
  // Self-hosted by @nuxt/fonts at build time, so the PWA keeps them offline.
  fonts: {
    families: [
      // Upright only, Latin + Latin Extended (Serbian Latin's č ć š ž đ): every style and
      // script Google offers added 96 @font-face rules and 23 KB of CSS.
      {
        name: "Fraunces",
        provider: "google",
        weights: [500, 600, 700, 800],
        styles: ["normal"],
        subsets: ["latin", "latin-ext"],
      },
      {
        name: "Inter Tight",
        provider: "google",
        weights: [400, 500, 600, 700, 800],
        styles: ["normal"],
        subsets: ["latin", "latin-ext"],
      },
    ],
  },
  pwa: {
    // Off on Wavedash: it runs the game in a cross-origin frame, where a worker would at best do nothing
    // and at worst keep serving an old build after a new publish.
    disable: !!process.env.WAVEDASH,
    registerType: "autoUpdate",
    manifest: {
      name: "Sudoku Pro",
      short_name: "Sudoku Pro",
      description:
        "Sudoku with a step-by-step hint analyzer, daily puzzles, and a technique academy.",
      lang: "en",
      theme_color: "#17294a",
      background_color: "#17294a",
      display: "standalone",
      orientation: "portrait",
      categories: ["games", "puzzle", "education"],
      icons: [
        { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    generateSW: {
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
        // Navy ink on paper, the slate ground (--ground in main.css) in dark mode. app.vue
        // repaints both when Settings forces a theme the system doesn't use.
        { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#17294a" },
        { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#1c252f" },
        // The app has its own dark mode: keep Dark Reader from repainting it (it hid the board's
        // lines). main.css declares color-scheme for the same reason.
        { name: "darkreader-lock", content: "lock" },
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
      ],
    },
  },
});
