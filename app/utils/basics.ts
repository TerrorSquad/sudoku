// "How to play": four short, hand-built lessons for someone new to sudoku, before the technique
// path. Every board is cut from one solved grid, so every asked answer is that grid's digit.
// Pure; unit-tested in tests/basics.test.ts.

import type { Grid } from "../types/sudoku";
import type { BoardUnit, CellRC } from "./sudokuGrader";

import { sameCell } from "./gridNav";
import { getGridCandidates } from "./sudokuCore";

export const BASICS_KEY = "sudoku_v1_basics_done";

export const SOLUTION = toGrid(
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
);

export type BasicsId = "rule" | "notes" | "single" | "scan";

interface BasicsTask {
  /** place: put the cell's digit in; notes: pencil in every digit that could go there. */
  kind: "place" | "notes";
  /** i18n key of the coach's prompt (`basics.task.<prompt>`). */
  prompt: string;
  board: Grid;
  /** The cell the task is about; its answer is SOLUTION's digit (or, for notes, its candidates). */
  cell: CellRC;
  /** Where to look: highlighted on the board, and named in the prompt. */
  unit?: BoardUnit;
  /** The task starts with this cell selected (finding it isn't the point). */
  preselect?: boolean;
  /** Every empty cell starts with its pencil marks. */
  withNotes?: boolean;
  /** Scanning: the digit whose placed copies rule out the box's other cells. */
  scan?: number;
}

function toGrid(s: string): Grid {
  return Array.from({ length: 9 }, (_, r) => Array.from(s.slice(r * 9, r * 9 + 9), Number));
}
const unitCells = ({ kind, r, c }: BoardUnit): CellRC[] =>
  Array.from({ length: 9 }, (_, i) =>
    kind === "row"
      ? { r, c: i }
      : kind === "col"
        ? { r: i, c }
        : { r: r - (r % 3) + Math.floor(i / 3), c: c - (c % 3) + (i % 3) },
  );
/** SOLUTION showing only `cells`. */
const only = (cells: CellRC[]): Grid =>
  SOLUTION.map((row, r) => row.map((v, c) => (cells.some((p) => sameCell(p, { r, c })) ? v : 0)));
/** SOLUTION with `cells` emptied. */
const without = (cells: CellRC[]): Grid =>
  SOLUTION.map((row, r) => row.map((v, c) => (cells.some((p) => sameCell(p, { r, c })) ? 0 : v)));
/** One unit filled in but for `cell`, nothing else: the rule on its own. */
function ruleTask(prompt: string, unit: BoardUnit, cell: CellRC): BasicsTask {
  const board = only(unitCells(unit).filter((p) => !sameCell(p, cell)));
  return { kind: "place", prompt, board, cell, unit, preselect: true };
}

// The notes cell's peers holding 1 or 9 are emptied, so 1, 5 (its answer) and 9 are left to it.
const NOTES_CELL = { r: 4, c: 4 };
const peers = ({ r, c }: CellRC) =>
  SOLUTION.flatMap((row, pr) => row.map((_, pc) => ({ r: pr, c: pc }))).filter(
    (p) =>
      !sameCell(p, { r, c }) &&
      (p.r === r ||
        p.c === c ||
        (Math.floor(p.r / 3) === Math.floor(r / 3) && Math.floor(p.c / 3) === Math.floor(c / 3))),
  );
const notesBoard = without([
  NOTES_CELL,
  ...peers(NOTES_CELL).filter((p) => [1, 9].includes(SOLUTION[p.r]![p.c]!)),
  { r: 0, c: 2 },
  { r: 2, c: 7 },
  { r: 7, c: 1 },
  { r: 8, c: 6 },
]);

export const BASICS: Record<BasicsId, BasicsTask[]> = {
  rule: [
    ruleTask("row", { kind: "row", r: 4, c: 0 }, { r: 4, c: 6 }),
    ruleTask("col", { kind: "col", r: 0, c: 2 }, { r: 6, c: 2 }),
    ruleTask("box", { kind: "box", r: 6, c: 6 }, { r: 7, c: 7 }),
  ],
  notes: [{ kind: "notes", prompt: "notes", board: notesBoard, cell: NOTES_CELL, preselect: true }],
  // Found by search: (8, 6) is the only cell down to one pencil mark.
  single: [
    {
      kind: "place",
      prompt: "single",
      board: toGrid(
        "500670002002000048090042000800700400006003001000004050900507204007009600345080079",
      ),
      cell: { r: 8, c: 6 },
      withNotes: true,
    },
  ],
  // The 5s in rows 2 and 3 and columns 2 and 3 leave the top-left box one place for its 5.
  scan: [
    {
      kind: "place",
      prompt: "scan",
      board: only([
        { r: 1, c: 5 },
        { r: 2, c: 6 },
        { r: 3, c: 1 },
        { r: 8, c: 2 },
        { r: 1, c: 1 },
        { r: 2, c: 0 },
        { r: 4, c: 4 },
        { r: 6, c: 7 },
      ]),
      cell: { r: 0, c: 0 },
      unit: { kind: "box", r: 0, c: 0 },
      scan: 5,
    },
  ],
};
export const BASICS_IDS = Object.keys(BASICS) as BasicsId[];

/** The digits that could go in (r, c): none already in its row, column or box. */
export const candidatesAt = (board: Grid, { r, c }: CellRC): number[] =>
  board[r]![c] ? [] : getGridCandidates(board)[r]![c]!;

/**
 * Which of the cell's units already holds `d` (the reason it can't go there), if any; `first` is
 * checked first, so a box exercise names the box.
 */
export function blockedBy(
  board: Grid,
  { r, c }: CellRC,
  d: number,
  first?: BoardUnit["kind"],
): BoardUnit["kind"] | null {
  const kinds = ["row", "col", "box"] as const;
  for (const kind of first ? [first, ...kinds.filter((k) => k !== first)] : kinds)
    if (unitCells({ kind, r, c }).some((p) => board[p.r]![p.c] === d)) return kind;
  return null;
}

/** For scanning: the placed copy of `d` whose row or column rules out (r, c), if one does. */
export function hatchedBy(board: Grid, { r, c }: CellRC, d: number): CellRC | null {
  for (let i = 0; i < 9; i++) {
    if (board[r]![i] === d) return { r, c: i };
    if (board[i]![c] === d) return { r: i, c };
  }
  return null;
}

/** Completed basics lessons from storage, known ids only. */
export const readBasics = (v: unknown): BasicsId[] =>
  Array.isArray(v) ? BASICS_IDS.filter((id) => v.includes(id)) : [];

/**
 * Two copies of the completed lessons as one: their union. Strings this version doesn't know (a
 * later version's lesson) pass through, so an older client never strips them.
 */
export function mergeBasics(a: unknown, b: unknown): string[] {
  const out = new Set<string>();
  for (const raw of [a, b])
    if (Array.isArray(raw)) for (const id of raw) if (typeof id === "string") out.add(id);
  return [...out];
}
