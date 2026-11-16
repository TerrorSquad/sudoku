// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  // Off for visual runs: its badge shows a live timing and overlaps the UI in baselines.
  devtools: { enabled: !process.env.VISUAL_REGRESSION },
  modules: ["@nuxt/ui", "@nuxtjs/i18n"],
  css: ["~/assets/css/main.css"],
  // Generate theme CSS only for the Nuxt UI components the app uses: 260 KB of CSS otherwise.
  ui: { experimental: { componentDetection: true } },
  // Self-hosted by @nuxt/fonts at build time.
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
    // `pnpm wavedash` sets NUXT_APP_BASE_URL=./ (relative assets); '/' for local dev.
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
      ],
      link: [{ rel: "icon", type: "image/x-icon", href: "favicon.ico" }],
    },
  },
});
