import { describe, expect, it, vi } from "vitest";

import { boardKey, emptyNotes, sameCell, stepCell } from "../utils/gridNav";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...mods }) as KeyboardEvent;

describe("gridNav", () => {
  it("compares cells by position", () => {
    expect(sameCell({ r: 1, c: 2 }, { r: 1, c: 2 })).toBe(true);
    expect(sameCell({ r: 1, c: 2 }, { r: 2, c: 1 })).toBe(false);
  });

  it("builds a 9×9 board of empty marks, fresh each time", () => {
    const a = emptyNotes();
    expect(a).toHaveLength(9);
    expect(a.every((row) => row.length === 9 && row.every((ns) => ns.length === 10))).toBe(true);
    expect(a.flat(2).some(Boolean)).toBe(false);
    a[0]![0]![1] = true;
    expect(a[0]![1]![1]).toBe(false);
    expect(emptyNotes()[0]![0]![1]).toBe(false);
  });

  it("lower-cases letters, ignores modified keys and turns Escape into back", () => {
    const back = vi.fn<() => void>();
    expect(boardKey(key("W"), back)).toBe("w");
    expect(boardKey(key("ArrowUp"), back)).toBe("ArrowUp");
    expect(boardKey(key("ArrowLeft", { altKey: true }), back)).toBeNull();
    expect(boardKey(key("z", { ctrlKey: true }), back)).toBeNull();
    expect(back).not.toHaveBeenCalled();
    expect(boardKey(key("Escape"), back)).toBeNull();
    expect(back).toHaveBeenCalledOnce();
  });

  it("steps and clamps at the edges", () => {
    expect(stepCell(null, "d")).toEqual({ r: 0, c: 0 });
    expect(stepCell({ r: 0, c: 8 }, "ArrowRight")).toEqual({ r: 0, c: 8 });
    expect(stepCell({ r: 4, c: 4 }, "s")).toEqual({ r: 5, c: 4 });
    expect(stepCell({ r: 4, c: 4 }, "x")).toBeNull();
  });
});
