import { describe, it, expect } from "vitest";

import type { Grid } from "../types/sudoku";

import {
  makeRng,
  seedFromString,
  countSolutions,
  hasUniqueSolution,
  solveBoard,
  generateSolvedGrid,
  generatePuzzle,
  isValidPlacement,
  getConflictCells,
  getGridCandidates,
} from "../utils/sudokuCore";

function isCompleteValidGrid(board: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = board[r]![c]!;
      if (v < 1 || v > 9) return false;
      if (!isValidPlacement(board, r, c, v)) return false;
    }
  }
  return true;
}

describe("sudokuCore — solver", () => {
  it("countSolutions detects multiple solutions", () => {
    // Empty grid has a vast number of solutions; limit caps the count
    const empty: Grid = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    expect(countSolutions(empty, 2)).toBe(2);
  });

  it("countSolutions returns 0 for conflicting givens", () => {
    const board: Grid = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    board[0]![0] = 5;
    board[0]![1] = 5;
    expect(countSolutions(board)).toBe(0);
  });

  it("solveBoard solves a known puzzle to its unique solution", () => {
    const solution = generateSolvedGrid(makeRng(42));
    const { puzzle } = generatePuzzle(40, makeRng(42));
    const solved = solveBoard(puzzle);
    expect(solved).toEqual(solution);
  });
});

describe("sudokuCore — board helpers", () => {
  it("getConflictCells finds row, column and box conflicts", () => {
    const board: Grid = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    board[0]![5] = 7; // same row
    board[4]![0] = 7; // same column
    board[1]![1] = 7; // same box
    const conflicts = getConflictCells(board, 0, 0, 7);
    expect(conflicts).toContainEqual({ r: 0, c: 5 });
    expect(conflicts).toContainEqual({ r: 4, c: 0 });
    expect(conflicts).toContainEqual({ r: 1, c: 1 });
    expect(getConflictCells(board, 0, 0, 0)).toEqual([]);
  });

  it("getGridCandidates lists only valid digits for empty cells", () => {
    const { puzzle, solution } = generatePuzzle(40, makeRng(3));
    const candidates = getGridCandidates(puzzle);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r]![c] !== 0) {
          expect(candidates[r]![c]).toEqual([]);
        } else {
          expect(candidates[r]![c]).toContain(solution[r]![c]);
        }
      }
    }
  });
});

describe("sudokuCore — generator", () => {
  it("generateSolvedGrid produces a complete valid grid", () => {
    const grid = generateSolvedGrid(makeRng(1));
    expect(isCompleteValidGrid(grid)).toBe(true);
  });

  it("different seeds produce different grids", () => {
    const a = generateSolvedGrid(makeRng(1));
    const b = generateSolvedGrid(makeRng(2));
    expect(a).not.toEqual(b);
  });

  it("same seed is deterministic", () => {
    const a = generatePuzzle(45, makeRng(seedFromString("2026-06-11")));
    const b = generatePuzzle(45, makeRng(seedFromString("2026-06-11")));
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.solution).toEqual(b.solution);
  });

  it("puzzle cells match the solution where given", () => {
    const { puzzle, solution } = generatePuzzle(45, makeRng(7));
    const given = puzzle
      .flatMap((row, r) => row.map((v, c) => ({ v, sol: solution[r]![c] })))
      .filter((cell) => cell.v !== 0);
    expect(given.length).toBeGreaterThan(0);
    for (const cell of given) {
      expect(cell.v).toBe(cell.sol);
    }
  });

  it.each([20, 30, 42, 52, 58, 62])(
    "generates a uniquely solvable puzzle removing %d cells",
    (removeCount) => {
      const { puzzle, solution, removed } = generatePuzzle(removeCount, makeRng(123));
      expect(hasUniqueSolution(puzzle)).toBe(true);
      expect(solveBoard(puzzle)).toEqual(solution);
      expect(removed).toBeGreaterThan(0);
      const blanks = puzzle.flat().filter((v) => v === 0).length;
      expect(blanks).toBe(removed);
    },
  );

  it("uniqueness holds across many random generations", () => {
    for (let i = 0; i < 10; i++) {
      const { puzzle } = generatePuzzle(58, makeRng(1000 + i));
      expect(hasUniqueSolution(puzzle)).toBe(true);
    }
  });
});
