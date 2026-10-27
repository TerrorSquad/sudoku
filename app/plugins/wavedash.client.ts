import { useAchievements } from "../composables/useAchievements";
import { initWavedash } from "../utils/wavedash";

// On Wavedash the platform shows its own loader until init(); elsewhere this is a no-op.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    initWavedash(Object.keys(useAchievements().getUnlocked()));
  });
});
