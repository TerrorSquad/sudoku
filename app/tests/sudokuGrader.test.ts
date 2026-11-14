import { describe, it, expect } from "vitest";

import type { Grid } from "../types/sudoku";

import { makeRng, generatePuzzle, hasUniqueSolution, solveBoard } from "../utils/sudokuCore";
import {
  solveLogically,
  gradePuzzle,
  generateGradedPuzzle,
  neededTechniques,
  patternUnit,
  singlesPath,
  techniquesRequired,
  STUCK,
  type SolveMove,
} from "../utils/sudokuGrader";

const grade = (d: string, seed: number) => generateGradedPuzzle(d, makeRng(seed)).grade;

describe("sudokuGrader — logical solver", () => {
  it("grades a nearly-full puzzle as singles (grade 1)", () => {
    const { puzzle } = generatePuzzle(20, makeRng(5));
    expect(gradePuzzle(puzzle)).toBe(1);
  });

  it("logical solution matches the backtracking solution when solvable", () => {
    expect.hasAssertions();
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
    // Average across seeds keeps this robust against the rare fallback board.
    const avg = (d: string) => [1, 2, 3, 4, 5].reduce((s, seed) => s + grade(d, seed), 0) / 5;
    expect(avg("beginner")).toBeLessThanOrEqual(avg("hard"));
    expect(avg("easy")).toBeLessThanOrEqual(avg("expert"));
  });
});

describe("sudokuGrader — neededTechniques", () => {
  it("lists only singles when nothing harder is needed", () => {
    const needed = neededTechniques(generatePuzzle(20, makeRng(5)).puzzle);
    expect(needed.length).toBeGreaterThan(0);
    for (const id of needed) expect(["naked-single", "hidden-single"]).toContain(id);
  });

  it("drops the singles and puts the hardest technique first", () => {
    const { puzzle } = generateGradedPuzzle("expert", makeRng(7));
    // The solver met these easiest-first: hidden single, pointing, hidden pair, xy-wing, naked single.
    expect([...techniquesRequired(puzzle)!]).toContain("naked-single");
    expect(neededTechniques(puzzle)).toEqual(["xy-wing", "hidden-pair", "pointing"]);
  });

  it("is empty when logic alone can't finish the board", () => {
    const empty: Grid = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    expect(neededTechniques(empty)).toEqual([]);
  });
});

describe("sudokuGrader — singlesPath", () => {
  it("fills a board that singles finish, in an order the solver can follow", () => {
    const { puzzle, solution } = generatePuzzle(20, makeRng(5));
    const path = singlesPath(puzzle)!;
    expect(path).toHaveLength(puzzle.flat().filter((v) => v === 0).length);
    for (const { r, c, num } of path) expect(num).toBe(solution[r]![c]);
  });

  it("is empty for a full board and null when singles run dry", () => {
    const { solution } = generatePuzzle(20, makeRng(5));
    expect(singlesPath(solution)).toEqual([]);
    expect(singlesPath(generateGradedPuzzle("expert", makeRng(7)).puzzle)).toBeNull();
  });
});

describe("sudokuGrader — patternUnit", () => {
  const move = (m: Partial<SolveMove>): SolveMove => ({
    technique: "naked-pair",
    tier: 2,
    eliminations: [],
    triggers: [],
    digits: [1],
    ...m,
  });

  it("names the one row, column or box that holds the whole pattern", () => {
    const pairInRow = move({
      triggers: [{ r: 3, c: 0 }, { r: 3, c: 7 }],
      eliminations: [{ r: 3, c: 4, num: 1 }],
    });
    expect(patternUnit(pairInRow)).toEqual({ kind: "row", r: 3, c: 4 });
    const pairInCol = move({
      triggers: [{ r: 0, c: 5 }, { r: 8, c: 5 }],
      eliminations: [{ r: 4, c: 5, num: 1 }],
    });
    expect(patternUnit(pairInCol).kind).toBe("col");
    const claiming = move({
      technique: "box-line",
      triggers: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
      eliminations: [{ r: 2, c: 2, num: 1 }],
    });
    expect(patternUnit(claiming)).toEqual({ kind: "box", r: 2, c: 2 });
  });

  it("falls back to the box the move acts in when the pattern spans units", () => {
    const xWing = move({
      technique: "x-wing",
      triggers: [{ r: 1, c: 1 }, { r: 1, c: 7 }, { r: 6, c: 1 }, { r: 6, c: 7 }],
      eliminations: [{ r: 4, c: 7, num: 1 }],
    });
    expect(patternUnit(xWing)).toEqual({ kind: "box", r: 4, c: 7 });
  });
});
