import { describe, it, expect } from "vitest";

import type { Grid } from "../types/sudoku";

import { makeRng, generatePuzzle, hasUniqueSolution, solveBoard } from "../utils/sudokuCore";
import { solveLogically, gradePuzzle, generateGradedPuzzle, STUCK } from "../utils/sudokuGrader";

describe("sudokuGrader — logical solver", () => {
  it("grades a nearly-full puzzle as singles (grade 1)", () => {
    const { puzzle } = generatePuzzle(20, makeRng(5));
    expect(gradePuzzle(puzzle)).toBe(1);
  });

  it("logical solution matches the backtracking solution when solvable", () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const { puzzle, solution } = generatePuzzle(45, makeRng(seed));
      const result = solveLogically(puzzle);
      if (result.solved) {
        expect(result.board).toEqual(solution);
        expect(solveBoard(puzzle)).toEqual(solution);
      }
    }
  });

  it("solved=true iff the board is complete; STUCK iff incomplete", () => {
    for (const seed of [99, 100, 101, 102]) {
      const { puzzle } = generatePuzzle(60, makeRng(seed));
      const result = solveLogically(puzzle);
      const flat = result.board.flat();
      if (result.solved) {
        expect(flat.every((v) => v >= 1 && v <= 9)).toBe(true);
        expect(result.grade).toBeLessThan(STUCK);
      } else {
        expect(result.grade).toBe(STUCK);
        expect(flat.some((v) => v === 0)).toBe(true);
      }
    }
  });

  it("grades the empty grid as STUCK (not logically solvable)", () => {
    const empty: Grid = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    expect(gradePuzzle(empty)).toBe(STUCK);
  });
});

describe("sudokuGrader — graded generation", () => {
  it.each(["beginner", "easy", "medium", "hard", "expert", "master"])(
    "always returns a fully logically-solvable %s puzzle (never STUCK)",
    (difficulty) => {
      const gp = generateGradedPuzzle(difficulty, makeRng(2026));
      expect(hasUniqueSolution(gp.puzzle)).toBe(true);
      expect(gp.grade).toBeGreaterThanOrEqual(1);
      expect(gp.grade).toBeLessThan(STUCK);
      // Grade is the genuine logical difficulty: the tier-only solver completes it.
      expect(solveLogically(gp.puzzle).solved).toBe(true);
      expect(solveBoard(gp.puzzle)).toEqual(gp.solution);
    },
  );

  it("beginner puzzles are always solvable with singles only", () => {
    for (const seed of [1, 2, 3]) {
      const gp = generateGradedPuzzle("beginner", makeRng(seed));
      expect(gp.grade).toBe(1);
    }
  });

  it("harder difficulties trend to higher tiers than easier ones", () => {
    const grade = (d: string, seed: number) => generateGradedPuzzle(d, makeRng(seed)).grade;
    // Average across seeds keeps this robust against the rare fallback board.
    const avg = (d: string) => [1, 2, 3, 4, 5].reduce((s, seed) => s + grade(d, seed), 0) / 5;
    expect(avg("beginner")).toBeLessThanOrEqual(avg("hard"));
    expect(avg("easy")).toBeLessThanOrEqual(avg("expert"));
  });
});
