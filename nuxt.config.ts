// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/i18n'],
  i18n: {
    locales: [{ code: 'en', language: 'en-US', file: 'en.json' }],
    defaultLocale: 'en',
    langDir: 'locales/',
    strategy: 'no_prefix',
  },
  ssr: false,
  app: {
    // Set via NUXT_APP_BASE_URL in CI (e.g. /sudoku/ for GitHub Pages).
    // Falls back to '/' for local dev.
    baseURL: process.env.NUXT_APP_BASE_URL ?? '/',
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;900&display=swap',
        },
      ],
    },
  },
})