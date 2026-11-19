import { defineAsyncComponent, nextTick, ref, shallowRef, watch, type Component } from "vue";

import { useClockHolds } from "./useClockHolds";
import { usePreferences } from "./usePreferences";
import { useTimer } from "./useTimer";

// A game's session around the board: its clock and what holds it (useClockHolds), the pause, the
// sheets over the paused game, the controls tour and the tab being hidden.
export function useGameSession({
  live,
  finishing,
  onAway,
}: {
  /** The game screen is up. */
  live: () => boolean;
  /** Finish is filling the board in: the game can't be paused meanwhile. */
  finishing: () => boolean;
  /** The tab was hidden and the game paused: close what a paused game can't keep open. */
  onAway: () => void;
}) {
  const { controlsTour } = usePreferences();
  const timer = useTimer();
  const { holds, isPaused, togglePause } = useClockHolds(live, {
    start: timer.startTimer,
    stop: timer.stopTimer,
  });

  // Settings opened from the pause screen open over it: the game stays paused and the board covered.
  const settingsOverGame = ref(false);
  // Loaded before the sheet opens: showModal() focuses its first button, so that must be there.
  const SettingsSheet = shallowRef<Component>();
  async function openGameSettings() {
    // The same lazy chunk as the Settings screen.
    SettingsSheet.value ??= (await import("../components/SettingsScreen.vue")).default;
    // The player may have left the game (or resumed it) while it loaded.
    if (!live() || !isPaused.value) return;
    settingsOverGame.value = true;
  }

  const shortcutsOpen = ref(false);
  // The controls tour (ControlsTour): once on a new player's first game, again from Settings or the
  // ? sheet. A paused game resumes so the controls show. The first one holds the clock (without the
  // pause overlay, which would cover the controls); a replay doesn't: no free look at the board.
  const touring = ref(false);
  async function startTour(holdClock = false) {
    controlsTour.value = false;
    shortcutsOpen.value = false;
    settingsOverGame.value = false;
    holds.delete("paused");
    if (holdClock) holds.add("tour");
    await nextTick(); // a closing sheet hands focus back first, then the tour takes it
    touring.value = true;
  }
  watch(touring, (on) => {
    if (!on) holds.delete("tour");
  });
  // The screen Transition's after-enter: a new player's first game starts with the tour.
  function onScreenEntered() {
    if (live() && controlsTour.value) startTour(true);
  }
  // driver.js loads with the tour; if it can't, the tour is off, never a game stuck without keys.
  const ControlsTour = defineAsyncComponent({
    loader: () => import("../components/ControlsTour.vue"),
    onError(_error, _retry, fail) {
      touring.value = false;
      fail();
    },
  });

  // Switching tabs/apps shouldn't quietly burn time against the player's score.
  useEventListener(document, "visibilitychange", () => {
    if (document.hidden && live() && !isPaused.value && !finishing()) {
      holds.add("paused");
      settingsOverGame.value = false; // back on the pause screen, which a paused clock needs
      onAway();
    }
  });

  return {
    timer,
    clockHolds: holds,
    isPaused,
    togglePause,
    settingsOverGame,
    SettingsSheet,
    openGameSettings,
    shortcutsOpen,
    touring,
    startTour,
    onScreenEntered,
    ControlsTour,
  };
}
