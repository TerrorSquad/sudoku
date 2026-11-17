import { describe, expect, it } from "vitest";

import type { Grid } from "../types/sudoku";

import en from "../../i18n/locales/en.json";
import { narrate } from "../utils/explain";
import { patternMarks } from "../utils/patternMarks";
import {
  countSolutions,
  generatePuzzle,
  getConflictCells,
  getGridCandidates,
  isValidPlacement,
  makeRng,
  solveBoard,
} from "../utils/sudokuCore";
import {
  generateGradedPuzzle,
  nextHint,
  patternUnit,
  solveLogically,
  type DigitAt,
  type SolveMove,
} from "../utils/sudokuGrader";

const messages = en as Record<string, string>;
const t = (key: string, params: Record<string, unknown> = {}) =>
  (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));

const empty = (): Grid => Array.from({ length: 9 }, () => Array(9).fill(0));
const diagonals = (g: Grid) => [g.map((row, i) => row[i]!), g.map((row, i) => row[8 - i]!)];
const isXSolution = (g: Grid) =>
  [...g, ...g.map((_, c) => g.map((row) => row[c]!)), ...diagonals(g)].every(
    (unit) => new Set(unit).size === 9 && !unit.includes(0),
  );

describe("X-Sudoku rules", () => {
  // A 5 at (0, 0) and a cell on the same diagonal that shares no row, column or box with it.
  const board = empty();
  board[0]![0] = 5;

  it("a digit repeated on a diagonal is invalid only in X", () => {
    expect(isValidPlacement(board, 4, 4, 5)).toBe(true);
    expect(isValidPlacement(board, 4, 4, 5, "x")).toBe(false);
    expect(isValidPlacement(board, 4, 5, 5, "x")).toBe(true); // off the diagonal
  });

  it("names the diagonal cell as the conflict", () => {
    expect(getConflictCells(board, 8, 8, 5)).toEqual([]);
    expect(getConflictCells(board, 8, 8, 5, "x")).toEqual([{ r: 0, c: 0 }]);
  });

  it("drops the diagonal's digits from candidates", () => {
    expect(getGridCandidates(board)[6]![6]).toContain(5);
    expect(getGridCandidates(board, "x")[6]![6]).not.toContain(5);
    expect(getGridCandidates(board, "x")[6]![2]).toContain(5); // the other diagonal
  });

  it("generates unique X puzzles whose solution keeps both diagonals", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { puzzle, solution } = generatePuzzle(58, makeRng(seed), "x");
      expect(isXSolution(solution)).toBe(true);
      expect(countSolutions(puzzle, 2, "x")).toBe(1);
      expect(solveBoard(puzzle, "x")).toEqual(solution);
    }
  });
});

describe("X-Sudoku hints", () => {
  // Every hint, replayed to the end on many X boards: never a placement or removal that the
  // solution contradicts, and never a uniqueness argument (the diagonals can break its swap).
  it("never contradicts the solution", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const { puzzle, solution } = generatePuzzle(54 + (seed % 7), makeRng(seed * 7919), "x");
      const board = puzzle.map((row) => [...row]);
      const elims: DigitAt[] = [];
      for (let step = 0; step < 600; step++) {
        const move: SolveMove | null = nextHint(board, elims, "x");
        if (!move) break;
        expect(move.technique).not.toBe("unique-rectangle");
        expect(move.technique).not.toBe("bug-plus-one");
        seen.add(move.unit ? `${move.technique}:${move.unit}` : move.technique);
        // Told in words too, with a sentence for every diagonal unit.
        const cands = getGridCandidates(board, "x");
        const has = (r: number, c: number, n: number) =>
          cands[r]![c]!.includes(n) && !elims.some((e) => e.r === r && e.c === c && e.num === n);
        for (const { text } of narrate(move, has, t, String, "x"))
          expect(text).not.toMatch(/[{}]|explain\./);
        if (move.placement) {
          const { r, c, num } = move.placement;
          expect(num).toBe(solution[r]![c]);
          board[r]![c] = num;
        } else {
          for (const e of move.eliminations) expect(e.num).not.toBe(solution[e.r]![e.c]);
          elims.push(...move.eliminations);
        }
      }
    }
    // The diagonal units are really used.
    expect([...seen].some((k) => k.endsWith(":diag") || k.endsWith(":anti"))).toBe(true);
  });

  it("finds a box-diagonal intersection", () => {
    // Box 0 keeps 1 only on its diagonal cells (0,0) and (1,1): the rest of the diagonal loses it.
    const board = empty();
    board[0]![1] = 2;
    board[0]![2] = 3;
    board[1]![0] = 4;
    board[1]![2] = 5;
    board[2]![0] = 6;
    board[2]![1] = 7;
    board[2]![2] = 8;
    const all: SolveMove[] = [];
    const elims: DigitAt[] = [];
    for (let i = 0; i < 40; i++) {
      const m = nextHint(board, elims, "x");
      if (!m || m.placement) break;
      all.push(m);
      elims.push(...m.eliminations);
    }
    const diagPointing = all.find(
      (m) => m.technique === "pointing" && m.triggers.every((p) => p.r === p.c),
    );
    expect(diagPointing?.eliminations.every((e) => e.r === e.c && e.r > 2)).toBe(true);
  });

  it("grades and generates every level, solvable by logic and unique", () => {
    for (const level of ["beginner", "easy", "medium", "hard", "expert", "master"]) {
      const g = generateGradedPuzzle(level, makeRng(11), undefined, "x");
      expect(countSolutions(g.puzzle, 2, "x")).toBe(1);
      const solved = solveLogically(g.puzzle, "x");
      expect(solved.solved).toBe(true);
      expect(solved.board).toEqual(g.solution);
    }
  });

  it("a nudge names the diagonal a pattern lies on, only in X", () => {
    const move: SolveMove = {
      technique: "pointing",
      tier: 2,
      eliminations: [{ r: 5, c: 5, num: 1 }],
      triggers: [
        { r: 0, c: 0 },
        { r: 1, c: 1 },
      ],
      digits: [1],
    };
    expect(patternUnit(move, "x").kind).toBe("diag");
    expect(patternUnit(move).kind).toBe("box");
  });

  it("draws a diagonal unit as a line corner to corner", () => {
    const marks = patternMarks(
      {
        technique: "hidden-single",
        triggers: [],
        eliminations: [],
        placement: { r: 2, c: 6, num: 4 },
        digits: [4],
        unit: "anti",
      },
      () => false,
    );
    expect(marks[0]).toMatchObject({ kind: "line", a: { x: 8.9, y: 0.1 }, b: { x: 0.1, y: 8.9 } });
  });
});
