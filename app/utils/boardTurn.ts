// The game board turned a quarter at a time (the rotate button, R): a sudoku symmetry, so it's
// display only. Everything stored stays in data coordinates; these map a data position to where
// the player sees it, for the words that name it (hints, nudges, labels) and the keys that walk it.
// `turn` counts clockwise quarter turns (any integer; 4 is back to normal). Pure; unit-tested in
// tests/boardTurn.test.ts.

import type { CellCoord } from "../types/sudoku";
import type { Pt } from "./patternMarks";
import type { BoardUnit, SolveMove } from "./sudokuGrader";

const quarters = (turn: number) => ((turn % 4) + 4) % 4;

/** Where data cell p shows: a clockwise quarter turn takes (r, c) to (c, 8 − r). */
export function turnCell<T extends CellCoord>(p: T, turn: number): T {
  let { r, c } = p;
  for (let i = quarters(turn); i > 0; i--) [r, c] = [c, 8 - r];
  return { ...p, r, c };
}

/** The data cell shown at displayed position p. */
export const unturnCell = <T extends CellCoord>(p: T, turn: number): T => turnCell(p, -turn);

const ODD: Record<BoardUnit["kind"], BoardUnit["kind"]> = {
  row: "col",
  col: "row",
  box: "box",
  diag: "anti",
  anti: "diag",
};
/** A unit as the player sees it: a data row shows as a column after an odd turn, and so on. */
export const turnKind = (kind: BoardUnit["kind"], turn: number) =>
  quarters(turn) % 2 ? ODD[kind] : kind;
export const turnUnit = (u: BoardUnit, turn: number): BoardUnit => ({
  ...turnCell(u, turn),
  kind: turnKind(u.kind, turn),
});

type Move = Pick<
  SolveMove,
  "technique" | "triggers" | "eliminations" | "placement" | "digits" | "unit"
>;
/** The same move on the board as the player sees it (a symmetry keeps it a valid move). */
export const turnMove = <M extends Move>(m: M, turn: number): M => ({
  ...m,
  triggers: m.triggers.map((p) => turnCell(p, turn)),
  eliminations: m.eliminations.map((p) => turnCell(p, turn)),
  placement: m.placement && turnCell(m.placement, turn),
  unit: m.unit && turnKind(m.unit, turn),
});

/** Pencil marks looked up by displayed position. */
export const turnHas =
  (has: (r: number, c: number, n: number) => boolean, turn: number) =>
  (r: number, c: number, n: number) => {
    const p = unturnCell({ r, c }, turn);
    return has(p.r, p.c, n);
  };

/**
 * A pen point over the turned board, in board units. Each cell's contents turn back upright, so a
 * pencil mark's slot (a point on the cell's 3×3 mark grid) moves round the cell centre with them;
 * any other point (a diagonal's corner-to-corner line) stays where it is.
 */
export function turnSlot(p: Pt, turn: number): Pt {
  const cx = Math.floor(p.x) + 0.5;
  const cy = Math.floor(p.y) + 0.5;
  let dx = p.x - cx;
  let dy = p.y - cy;
  if (Math.abs(dx) > 0.34 || Math.abs(dy) > 0.34) return p;
  for (let i = quarters(turn); i > 0; i--) [dx, dy] = [dy, -dx]; // a quarter anticlockwise
  return { x: cx + dx, y: cy + dy };
}
