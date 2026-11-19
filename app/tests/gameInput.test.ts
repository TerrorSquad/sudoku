import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

import type { CellCoord } from "../types/sudoku";

vi.mock("../utils/gridNav", async (load) => ({
  ...(await load<typeof import("../utils/gridNav")>()),
  focusCell: () => {}, // the DOM's part
}));

import { useGameInput } from "../composables/useGameInput";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, preventDefault: () => {}, ...mods }) as KeyboardEvent;

function setup() {
  const grid = () => Array.from({ length: 9 }, () => Array(9).fill(0) as number[]);
  const initialBoard = ref(grid());
  initialBoard.value[0]![0] = 5; // a given
  const s = {
    digitFirst: ref(false),
    noteTap: ref(false),
    selectedCell: ref<CellCoord | null>(null),
    initialBoard,
    currentBoard: ref(grid()),
    numberCounts: ref(Array(10).fill(0) as number[]),
    notesMode: ref(false),
    inGame: ref(true),
    keys: true,
    isPaused: false,
    isFinishing: false,
    log: [] as string[],
  };
  const act = new Proxy({} as Parameters<typeof useGameInput>[0]["act"], {
    get: (_, name) => (arg?: number) => s.log.push(arg ? `${String(name)} ${arg}` : String(name)),
  });
  const input = useGameInput({
    ...s,
    hasKeys: () => s.keys,
    paused: () => s.isPaused,
    finishing: () => s.isFinishing,
    act,
  });
  return { ...s, ...input, s };
}

describe("useGameInput", () => {
  it("digit-first: the numpad arms a digit and a tap on an empty cell places it", () => {
    const g = setup();
    g.s.digitFirst.value = true;
    g.handleNumpad(4);
    expect(g.activeDigit.value).toBe(4);
    expect(g.s.log).toEqual([]);
    g.handleSelectCell({ r: 0, c: 0 }); // a given: only selects
    g.handleSelectCell({ r: 1, c: 1 });
    expect(g.s.log).toEqual(["input 4"]);
    g.s.currentBoard.value[2]![2] = 7; // another digit there: never replaced
    g.handleSelectCell({ r: 2, c: 2 });
    expect(g.s.log).toEqual(["input 4"]);
    g.handleNumpad(4); // pressed again: disarmed
    expect(g.activeDigit.value).toBeNull();
  });

  it("outside digit-first the numpad enters the digit and picks it", () => {
    const g = setup();
    g.handleNumpad(6);
    expect(g.pickedDigit.value).toBe(6);
    expect(g.s.log).toEqual(["input 6"]);
  });

  it("an armed digit goes once all nine are placed, or the player leaves the game", async () => {
    const g = setup();
    g.s.digitFirst.value = true;
    g.handleNumpad(3);
    g.s.numberCounts.value = g.s.numberCounts.value.map((n, d) => (d === 3 ? 9 : n));
    await nextTick();
    expect(g.activeDigit.value).toBeNull();
    g.handleNumpad(2);
    g.s.inGame.value = false;
    await nextTick();
    expect(g.activeDigit.value).toBeNull();
  });

  it("arrows move the selection and never place an armed digit", () => {
    const g = setup();
    g.s.digitFirst.value = true;
    g.handleNumpad(4);
    g.handleKeyDown(key("ArrowDown"));
    g.handleKeyDown(key("d"));
    expect(g.s.selectedCell.value).toEqual({ r: 0, c: 1 });
    expect(g.s.log).toEqual([]);
  });

  it("keys: P pauses, and a paused or finishing game takes no moves", () => {
    const g = setup();
    g.handleKeyDown(key("7"));
    g.handleKeyDown(key("z", { ctrlKey: true }));
    g.handleKeyDown(key("Z", { shiftKey: true }));
    g.handleKeyDown(key("n"));
    expect(g.s.log).toEqual(["input 7", "undo", "history"]);
    expect(g.s.notesMode.value).toBe(true);
    g.s.isPaused = true;
    g.handleKeyDown(key("8"));
    g.handleKeyDown(key("p"));
    expect(g.s.log.slice(3)).toEqual(["pause"]);
    g.s.isPaused = false;
    g.s.isFinishing = true;
    g.handleKeyDown(key("p"));
    g.handleKeyDown(key("8"));
    g.s.keys = false;
    g.s.isFinishing = false;
    g.handleKeyDown(key("?"));
    expect(g.s.log.slice(4)).toEqual([]);
  });
});
