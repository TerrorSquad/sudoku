import { onMounted, onUnmounted, ref } from "vue";

import { firedActions, heldActions, type PadAction } from "../utils/gamepad";

/**
 * Polls connected controllers once a frame (only while one is connected) and calls `onAction`
 * for each press and repeat. `connected` is true while any pad is plugged in.
 */
export function useGamepad(onAction: (action: PadAction) => void) {
  const connected = ref(false);
  const timers = new Map<PadAction, number>();
  let frame = 0;

  const pads = () => (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p);

  function poll() {
    const held = new Set<PadAction>();
    for (const pad of pads()) heldActions(pad, held);
    for (const action of firedActions(held, timers, performance.now())) onAction(action);
    frame = requestAnimationFrame(poll);
  }
  function start() {
    connected.value = true;
    if (!frame) frame = requestAnimationFrame(poll);
  }
  function stop() {
    if (pads().length) return; // another pad is still plugged in
    connected.value = false;
    cancelAnimationFrame(frame);
    frame = 0;
    timers.clear();
  }

  onMounted(() => {
    window.addEventListener("gamepadconnected", start);
    window.addEventListener("gamepaddisconnected", stop);
    if (pads().length) start();
  });
  onUnmounted(() => {
    window.removeEventListener("gamepadconnected", start);
    window.removeEventListener("gamepaddisconnected", stop);
    cancelAnimationFrame(frame);
  });

  return { connected };
}
