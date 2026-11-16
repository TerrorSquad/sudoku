// The app has no routes, but Nuxt's router still writes the address on start: with the ./ base (the
// Wavedash build) it joins the base to the path and /game/ becomes /game/game/, a blank page on any
// reload (F5, a backup import, a chunk error). Put the path back after every navigation (the start,
// back/forward); the query and hash stay as they are.
export default defineNuxtPlugin(() => {
  const path = window.location.pathname;
  useRouter().afterEach(() => {
    if (location.pathname !== path)
      history.replaceState(history.state, "", path + location.search + location.hash);
  });
});
