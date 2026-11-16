import { describe, expect, it } from "vitest";

import {
  REPEAT_DELAY_MS,
  REPEAT_MS,
  firedActions,
  heldActions,
  type PadAction,
} from "../utils/gamepad";

const pad = (pressed: number[], axes = [0, 0]) => ({
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes,
});

describe("gamepad", () => {
  it("maps the standard buttons and the left stick", () => {
    expect([...heldActions(pad([0, 12]))]).toEqual(["press", "up"]);
    expect([...heldActions(pad([], [0.9, 0.2]))]).toEqual(["right"]);
    expect([...heldActions(pad([], [0.1, -0.8]))]).toEqual(["up"]);
    expect([...heldActions(pad([], [0.3, 0.3]))]).toEqual([]); // inside the deadzone
  });

  it("fires once per press, and repeats a held direction after a delay", () => {
    const timers = new Map<PadAction, number>();
    const held = new Set<PadAction>(["down", "press"]);
    expect(firedActions(held, timers, 0)).toEqual(["down", "press"]);
    expect(firedActions(held, timers, REPEAT_DELAY_MS - 1)).toEqual([]);
    expect(firedActions(held, timers, REPEAT_DELAY_MS)).toEqual(["down"]); // press never repeats
    expect(firedActions(held, timers, REPEAT_DELAY_MS + REPEAT_MS)).toEqual(["down"]);
    // Released, then pressed again: fires at once.
    expect(firedActions(new Set(), timers, 1000)).toEqual([]);
    expect(firedActions(held, timers, 1001)).toEqual(["down", "press"]);
  });
});
