import { onMounted, onUnmounted, ref } from "vue";

import { firedActions, heldActions, type PadAction } from "../utils/gamepad";

/** On a board, the key each action sends; `clicks`: A on a focused button presses it instead. */
export interface PadKeys extends Partial<Record<PadAction, string>> {
  clicks?: boolean;
}

interface PadOptions {
  /** True while the D-pad should walk the cells rather than move focus. */
  onBoard: () => boolean;
  /** The keys for the board on screen, given the digit LB/RB picked. */
  boardKeys: (digit: number) => PadKeys;
  /** B off the board. */
  onBack: () => void;
  /** Start off the board. */
  onPause: () => void;
}

/** A key press as the focused element would get it, so each screen's own key handling answers. */
export function sendKey(key: string) {
  (document.activeElement ?? document.body).dispatchEvent(
    // A capital letter is typed with Shift (the move history's Shift+Z).
    new KeyboardEvent("keydown", { key, bubbles: true, shiftKey: key !== key.toLowerCase() }),
  );
}

const FOCUSABLE =
  'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea, [tabindex]:not([tabindex="-1"])';
/** Where focus moves: the topmost open dialog or `[data-pad-scope]` overlay, else the page. */
export function padScope(): ParentNode {
  const scopes = document.querySelectorAll("dialog[open], [data-pad-scope]");
  return scopes[scopes.length - 1] ?? document;
}
function moveFocus(step: 1 | -1) {
  const list = [...padScope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
  if (!list.length) return;
  const i = list.indexOf(document.activeElement as HTMLElement);
  const next = i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
  list[next]!.focus();
}
const ARROWS = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

/**
 * Controllers, for a TV: each action becomes the key the screen already answers to. On a board,
 * the D-pad walks the cells and LB/RB pick the digit (`digit`) the board's keys enter; elsewhere
 * the D-pad moves focus, kept inside whatever overlay is on top, and A presses.
 * Polls connected controllers once a frame (only while one is connected); `connected` is true
 * while any pad is plugged in.
 */
export function usePad({ onBoard, boardKeys, onBack, onPause }: PadOptions) {
  const connected = ref(false);
  const digit = ref(1);
  const timers = new Map<PadAction, number>();
  let frame = 0;

  function onAction(action: PadAction) {
    const focused = document.activeElement as HTMLElement | null;
    const onControl = !!focused?.closest?.("button, a, select") && !focused.closest("[data-cell]");
    if (action === "prev" || action === "next") {
      digit.value = ((digit.value + (action === "next" ? 0 : 7)) % 9) + 1;
      return;
    }
    if (!onBoard()) {
      // A focused <select> can't be opened from script: left/right step through its options.
      if ((action === "left" || action === "right") && focused instanceof HTMLSelectElement) {
        const i = focused.selectedIndex + (action === "right" ? 1 : -1);
        if (i >= 0 && i < focused.options.length) {
          focused.selectedIndex = i;
          focused.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else if (
        (action === "left" || action === "right") &&
        focused instanceof HTMLInputElement &&
        focused.type === "range"
      ) {
        // Nor does a synthetic arrow key move a slider (the move history's).
        if (action === "right") focused.stepUp();
        else focused.stepDown();
        focused.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (action in ARROWS) moveFocus(action === "up" || action === "left" ? -1 : 1);
      else if (action === "press") {
        if (onControl) focused!.click();
        else moveFocus(1);
      } else if (action === "back") onBack();
      else if (action === "pause") onPause();
      return;
    }
    if (action in ARROWS) return sendKey(ARROWS[action as keyof typeof ARROWS]);
    const keys = boardKeys(digit.value);
    if (action === "press" && keys.clicks && onControl) return focused!.click();
    const key = keys[action];
    if (key) sendKey(key);
  }

  const pads = () => (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p);

  function poll() {
    const held = new Set<PadAction>();
    for (const pad of pads()) heldActions(pad, held);
    for (const action of firedActions(held, timers, performance.now())) onAction(action);
    frame = requestAnimationFrame(poll);
  }
  function start() {
    connected.value = true;
    if (frame) return;
    // The press that woke the pad (Chrome exposes pads only after one) mustn't also act.
    const held = new Set<PadAction>();
    for (const pad of pads()) heldActions(pad, held);
    for (const action of held) timers.set(action, Infinity);
    frame = requestAnimationFrame(poll);
  }
  function stop() {
    if (pads().length) return; // another pad is still plugged in
    connected.value = false;
    cancelAnimationFrame(frame);
    frame = 0;
    timers.clear();
  }

  useEventListener(window, "gamepadconnected", start);
  useEventListener(window, "gamepaddisconnected", stop);
  onMounted(() => {
    if (pads().length) start();
  });
  onUnmounted(() => cancelAnimationFrame(frame));

  return { connected, digit };
}
