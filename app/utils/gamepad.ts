// Controller input, for playing on a TV: the standard-mapping buttons and the left stick as
// actions, with key-repeat for the D-pad. Pure; unit-tested in tests/gamepad.test.ts.
// useGamepad (composables) polls the pads and turns actions into keys; app.vue supplies each
// screen's key map.

export type PadAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "press" // A / Cross
  | "back" // B / Circle
  | "alt" // X / Square
  | "hint" // Y / Triangle
  | "prev" // LB
  | "next" // RB
  | "pause" // Start / Options
  | "help"; // Back / Select / Share

/** The W3C "standard" gamepad mapping: button index → action. */
const BUTTONS: Record<number, PadAction> = {
  0: "press",
  1: "back",
  2: "alt",
  3: "hint",
  4: "prev",
  5: "next",
  8: "help",
  9: "pause",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

/** Held this long, a direction (or digit change) starts repeating, then every REPEAT_MS. */
export const REPEAT_DELAY_MS = 350;
export const REPEAT_MS = 110;
const REPEATS = new Set<PadAction>(["up", "down", "left", "right", "prev", "next"]);
const DEADZONE = 0.5;

export interface PadSnapshot {
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
}

/** What a pad is holding right now: its buttons, and the left stick as a direction. */
export function heldActions(pad: PadSnapshot, into = new Set<PadAction>()): Set<PadAction> {
  pad.buttons.forEach((b, i) => {
    const action = BUTTONS[i];
    if (b.pressed && action) into.add(action);
  });
  const [x = 0, y = 0] = pad.axes;
  if (Math.abs(x) > DEADZONE || Math.abs(y) > DEADZONE) {
    if (Math.abs(x) > Math.abs(y)) into.add(x > 0 ? "right" : "left");
    else into.add(y > 0 ? "down" : "up");
  }
  return into;
}

/**
 * The actions to fire this frame: one on each press, then repeats while a direction is held.
 * `timers` keeps, per held action, when it next fires; it's updated in place.
 */
export function firedActions(
  held: Set<PadAction>,
  timers: Map<PadAction, number>,
  now: number,
): PadAction[] {
  const fired: PadAction[] = [];
  for (const action of timers.keys()) if (!held.has(action)) timers.delete(action);
  for (const action of held) {
    const due = timers.get(action);
    if (due === undefined) {
      fired.push(action);
      timers.set(action, REPEATS.has(action) ? now + REPEAT_DELAY_MS : Infinity);
    } else if (now >= due) {
      fired.push(action);
      timers.set(action, now + REPEAT_MS);
    }
  }
  return fired;
}
