import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string, p?: { n: number }) => `${key}:${p?.n}` }),
}));

import { useNudge } from "../composables/useNudge";

function setup() {
  const currentBoard = ref(Array.from({ length: 9 }, () => Array(9).fill(0) as number[]));
  // A wrong entry at row 1, column 5: the nudge points at its box.
  const engine = { currentBoard, peekHint: () => ({ at: { r: 0, c: 4 }, move: null }) };
  const hintsUsed = ref(0);
  const inGame = ref(true);
  return { currentBoard, hintsUsed, inGame, ...useNudge(engine, hintsUsed, inGame) };
}

describe("useNudge", () => {
  it("a nudge counts one hint, and explaining that same step is free", () => {
    const n = setup();
    expect(n.showNudge()).toBe(true);
    expect(n.nudge.value).toEqual({ unit: { kind: "box", r: 0, c: 4 }, technique: null });
    expect(n.nudgeUnit.value).toBe("hint.nudge.unit.box:2");
    expect(n.hintsUsed.value).toBe(1);
    expect(n.showNudge()).toBe(false); // already showing: the press explains instead
    n.chargeHint();
    expect(n.hintsUsed.value).toBe(1);
    n.chargeHint();
    expect(n.hintsUsed.value).toBe(2);
  });

  it("a board change or leaving the game drops the nudge and its credit", async () => {
    const n = setup();
    n.showNudge();
    n.currentBoard.value[0]![0] = 1;
    await nextTick();
    expect(n.nudge.value).toBeNull();
    n.chargeHint();
    expect(n.hintsUsed.value).toBe(2);

    n.showNudge();
    n.inGame.value = false;
    await nextTick();
    expect(n.nudge.value).toBeNull();
    n.chargeHint();
    expect(n.hintsUsed.value).toBe(4);
  });
});
