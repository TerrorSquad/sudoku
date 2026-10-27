// On Wavedash the platform injects its SDK and shows its own loader until init(); elsewhere it's absent.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    (globalThis as { Wavedash?: { init(): boolean } }).Wavedash?.init();
  });
});
