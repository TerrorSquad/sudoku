// A lazy screen whose chunk failed to load: reload the page (see nuxt.config.ts). reloadNuxtApp's
// TTL stops a loop when the chunk stays missing. Progress lives in localStorage and a win is
// recorded before its modal loads, so nothing is lost.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:chunkError", () => reloadNuxtApp({ persistState: true }));
});
