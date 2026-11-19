import { computed, reactive, watch } from "vue";

// Why the game clock is held. One rule: it runs while the game screen is live and nothing holds it.
// - "paused": the player's pause (the button, P, a controller), also set by leaving for another tab
//   or for a lesson from the game, which come back to it paused. The only one with the pause overlay.
// - "tour": a first controls tour, which holds the clock without covering the controls.
// - "finished": the game is over (the end modal), or Finish is filling the last cells in.
export type ClockHold = "paused" | "tour" | "finished";

export function useClockHolds(live: () => boolean, clock: { start: () => void; stop: () => void }) {
  const holds = reactive(new Set<ClockHold>());
  const running = computed(() => live() && holds.size === 0);
  watch(running, (on) => (on ? clock.start() : clock.stop()));
  const isPaused = computed(() => holds.has("paused"));
  function togglePause() {
    if (!holds.delete("paused")) holds.add("paused");
  }
  return { holds, running, isPaused, togglePause };
}
