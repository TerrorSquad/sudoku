// A lazy screen whose chunk failed to load: reload the page we started on. Not Nuxt's route: with
// the ./ base its router rewrites the address to /game/game/ on start (see nuxt.config.ts), so
// read the path now, before it does. reloadNuxtApp's TTL stops a loop when the chunk stays missing.
// Progress lives in localStorage and a win is recorded before its modal loads, so nothing is lost.
export default defineNuxtPlugin((nuxtApp) => {
  const path = window.location.pathname;
  nuxtApp.hook("app:chunkError", () => reloadNuxtApp({ path, persistState: true }));
});
