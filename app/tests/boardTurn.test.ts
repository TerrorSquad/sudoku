import { describe, expect, it } from "vitest";

import { turnCell, turnHas, turnMove, turnSlot, turnUnit, unturnCell } from "../utils/boardTurn";
import { stepCell } from "../utils/gridNav";
import { anchor, type Pt } from "../utils/patternMarks";

const cells = Array.from({ length: 81 }, (_, i) => ({ r: Math.floor(i / 9), c: i % 9 }));

describe("boardTurn", () => {
  it("a clockwise quarter takes (r, c) to (c, 8 − r); four are the identity", () => {
    expect(turnCell({ r: 0, c: 0 }, 1)).toEqual({ r: 0, c: 8 }); // top-left → top-right
    expect(turnCell({ r: 0, c: 8 }, 1)).toEqual({ r: 8, c: 8 });
    expect(turnCell({ r: 2, c: 5 }, 2)).toEqual({ r: 6, c: 3 });
    expect(turnCell({ r: 2, c: 5, num: 7 }, 1)).toEqual({ r: 5, c: 6, num: 7 }); // keeps extras
    for (const p of cells) {
      expect(turnCell(p, 4)).toEqual(p);
      expect(turnCell(turnCell(p, 1), 3)).toEqual(p);
      expect(turnCell(p, -1)).toEqual(turnCell(p, 3));
      for (const q of [1, 2, 3, 5]) expect(unturnCell(turnCell(p, q), q)).toEqual(p);
    }
  });

  it("names units as shown: rows and columns swap on odd turns, boxes renumber", () => {
    expect(turnUnit({ kind: "row", r: 3, c: 0 }, 1)).toEqual({ kind: "col", r: 0, c: 5 });
    expect(turnUnit({ kind: "col", r: 0, c: 2 }, 1)).toEqual({ kind: "row", r: 2, c: 8 });
    expect(turnUnit({ kind: "row", r: 3, c: 0 }, 2)).toEqual({ kind: "row", r: 5, c: 8 });
    // Box 1 (top-left) shows as box 3 (top-right).
    expect(turnUnit({ kind: "box", r: 1, c: 1 }, 1)).toEqual({ kind: "box", r: 1, c: 7 });
    expect(turnUnit({ kind: "diag", r: 4, c: 4 }, 1).kind).toBe("anti");
    expect(turnUnit({ kind: "anti", r: 4, c: 4 }, 3).kind).toBe("diag");
  });

  it("turns a move and looks pencil marks up where they show", () => {
    const move = {
      technique: "hidden-single" as const,
      triggers: [{ r: 0, c: 1 }],
      eliminations: [{ r: 4, c: 0, num: 3 }],
      placement: { r: 0, c: 0, num: 5 },
      digits: [5],
      unit: "row" as const,
    };
    const t = turnMove(move, 1);
    expect(t.placement).toEqual({ r: 0, c: 8, num: 5 });
    expect(t.triggers).toEqual([{ r: 1, c: 8 }]);
    expect(t.eliminations).toEqual([{ r: 0, c: 4, num: 3 }]);
    expect(t.unit).toBe("col");
    const has = turnHas((r, c, n) => r === 2 && c === 5 && n === 4, 1);
    expect(has(5, 6, 4)).toBe(true);
    expect(has(2, 5, 4)).toBe(false);
  });

  it("arrows move the way the turned board shows", () => {
    // Turned once, data column 0 is the top row: "right" on screen walks down data column 0.
    expect(stepCell({ r: 4, c: 0 }, "ArrowRight", 1)).toEqual({ r: 3, c: 0 });
    expect(stepCell({ r: 4, c: 0 }, "ArrowDown", 1)).toEqual({ r: 4, c: 1 });
    expect(stepCell({ r: 4, c: 4 }, "ArrowUp", 2)).toEqual({ r: 5, c: 4 });
    expect(stepCell({ r: 4, c: 4 }, "a", 3)).toEqual({ r: 3, c: 4 });
    // Nothing selected: the top-left cell as shown.
    expect(stepCell(null, "d", 1)).toEqual({ r: 8, c: 0 });
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
      for (const p of cells) expect(stepCell(p, key, 4)).toEqual(stepCell(p, key));
  });

  it("moves a pencil mark's slot with the upright mark; other points stay", () => {
    // Turned once, mark 1 shows top-left: in board units, the cell's bottom-left slot.
    const near = (p: Pt, q: Pt) => {
      expect(p.x).toBeCloseTo(q.x);
      expect(p.y).toBeCloseTo(q.y);
    };
    near(turnSlot(anchor(3, 3, 1), 1), anchor(3, 3, 7));
    near(turnSlot(anchor(3, 3, 3), 1), anchor(3, 3, 1));
    near(turnSlot(anchor(3, 3, 1), 2), anchor(3, 3, 9));
    near(turnSlot(anchor(3, 3, 5), 1), anchor(3, 3, 5));
    for (let n = 1; n <= 9; n++) near(turnSlot(anchor(6, 2, n), 4), anchor(6, 2, n));
    expect(turnSlot({ x: 0.1, y: 0.1 }, 1)).toEqual({ x: 0.1, y: 0.1 }); // a diagonal's end
  });
});
