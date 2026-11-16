import { useAchievements } from "../composables/useAchievements";
import { readPlayerStats } from "../composables/usePlayerStats";
import { initWavedash, saveToCloud, syncFromCloud } from "../utils/wavedash";

// On Wavedash the platform shows its own loader until init(); elsewhere all of this is a no-op.
export default defineNuxtPlugin(async (nuxtApp) => {
  // Nuxt mounts the app only after this resolves, so a cloud restore lands before any composable
  // reads localStorage. The platform loader covers the wait.
  await syncFromCloud();
  nuxtApp.hook("app:mounted", () => {
    initWavedash(Object.keys(useAchievements().getUnlocked()), readPlayerStats);
  });
  document.addEventListener("visibilitychange", () => document.hidden && saveToCloud(true));
});
