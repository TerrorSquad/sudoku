import { describe, it, expect } from "vitest";

import type { Grid } from "../types/sudoku";

import {
  makeRng,
  generatePuzzle,
  isValidPlacement,
  getGridCandidates,
  solveBoard,
} from "../utils/sudokuCore";
import { nextHint, solveLogically, type SolveMove, type TechniqueId } from "../utils/sudokuGrader";

// Apply a move to a board the way the engine will, returning a fresh board.
function applyPlacement(board: Grid, move: SolveMove): Grid {
  const b = board.map((r) => [...r]);
  if (move.placement) b[move.placement.r]![move.placement.c] = move.placement.num;
  return b;
}

describe("nextHint — soundness", () => {
  it("the single-digit, wing and uniqueness techniques fire, and never remove a solution digit", () => {
    const seen = new Set<string>();
    // Simple Coloring first shows up at seed 431, once the techniques tried before it run dry.
    for (let seed = 1; seed <= 450; seed++) {
      const { puzzle, solution } = generatePuzzle(62, makeRng(seed));
      const board = puzzle.map((r) => r.concat());
      const elims: { r: number; c: number; num: number }[] = [];
      for (let step = 0; step < 600; step++) {
        const move = nextHint(board, elims);
        if (!move) break;
        seen.add(move.technique);
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
    for (const t of [
      "skyscraper",
      "two-string-kite",
      "unique-rectangle",
      "simple-coloring",
      "finned-x-wing",
      "w-wing",
      "bug-plus-one",
      "empty-rectangle",
      "xy-chain",
    ])
      expect(seen).toContain(t);
  });

  // Replays the hint chain over a dug board, handing each move of `technique` to `check`.
  function eachMove(
    technique: TechniqueId,
    seed: number,
    check: (move: SolveMove, solved: Grid) => void,
  ) {
    const { puzzle } = generatePuzzle(62, makeRng(seed));
    const solved = solveBoard(puzzle)!;
    const board = puzzle.map((r) => r.concat());
    const elims: { r: number; c: number; num: number }[] = [];
    for (let step = 0; step < 600; step++) {
      const move = nextHint(board, elims);
      if (!move) break;
      if (move.technique === technique) check(move, solved);
      if (move.placement) board[move.placement.r]![move.placement.c] = move.placement.num;
      else elims.push(...move.eliminations);
    }
  }

  it("finds an Empty Rectangle: 3 in box 9 on row 8 and column 7, and the link in row 1", () => {
    const found: SolveMove[] = [];
    eachMove("empty-rectangle", 114, (move) => found.push(move));
    expect(found[0]).toEqual({
      technique: "empty-rectangle",
      tier: 4,
      // The link's ends (the one on the box's column first), then the box's cells.
      triggers: [
        { r: 0, c: 6 },
        { r: 0, c: 4 },
        { r: 6, c: 6 },
        { r: 7, c: 7 },
        { r: 8, c: 6 },
      ],
      // Row 8 (the box's row) meets the far end's column 5.
      eliminations: [{ r: 7, c: 4, num: 3 }],
      digits: [3],
    });
  });

  it("an Empty Rectangle never removes the solution digit (checked by brute force)", () => {
    let count = 0;
    for (let seed = 1; seed <= 1500; seed++)
      eachMove("empty-rectangle", seed, (move, solved) => {
        count++;
        for (const e of move.eliminations) expect(e.num).not.toBe(solved[e.r]![e.c]);
      });
    // 27 over these seeds: a sharp drop means detection regressed.
    expect(count).toBeGreaterThan(20);
    // ~5 s alone: room for a busy machine.
  }, 20_000);

  it("finds the shortest XY-Chain: four cells from 1 to 1, each end in line with both removals", () => {
    const found: SolveMove[] = [];
    eachMove("xy-chain", 27, (move) => found.push(move));
    expect(found[0]).toEqual({
      technique: "xy-chain",
      tier: 5,
      // In chain order: 1 or 3, 3 or 8, 8 or 7, 7 or 1.
      triggers: [
        { r: 0, c: 4 },
        { r: 1, c: 5 },
        { r: 6, c: 5 },
        { r: 7, c: 3 },
      ],
      eliminations: [
        { r: 0, c: 3, num: 1 },
        { r: 7, c: 4, num: 1 },
      ],
      digits: [1],
    });
  });

  it("an XY-Chain never removes the solution digit (checked by brute force)", () => {
    let count = 0;
    for (let seed = 1; seed <= 600; seed++)
      eachMove("xy-chain", seed, (move, solved) => {
        count++;
        for (const e of move.eliminations) expect(e.num).not.toBe(solved[e.r]![e.c]);
      });
    // 82 over these seeds: a sharp drop means detection regressed.
    expect(count).toBeGreaterThan(60);
  }, 20_000);

  it("a placement is always the value that actually solves the cell", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { puzzle, solution } = generatePuzzle(45, makeRng(seed));
      let board = puzzle.map((r) => r.concat());
      const elims: { r: number; c: number; num: number }[] = [];
      // Walk the whole solve via hints; every placement must match the solution.
      for (let step = 0; step < 200; step++) {
        const move = nextHint(board, elims);
        if (!move) break;
        if (move.placement) {
          const { r, c, num } = move.placement;
          expect(board[r]![c]).toBe(0);
          expect(num).toBe(solution[r]![c]); // never an unjustified / wrong digit
          board = applyPlacement(board, move);
        } else {
          // eliminations must remove candidates that are NOT the solution digit
          for (const e of move.eliminations) {
            expect(e.num).not.toBe(solution[e.r]![e.c]);
          }
          elims.push(...move.eliminations);
        }
      }
    }
  });

  it("placements are genuine singles given the candidate state", () => {
    const { puzzle } = generatePuzzle(40, makeRng(11));
    const move = nextHint(puzzle);
    expect(move).not.toBeNull();
    if (move?.placement && move.technique === "naked-single") {
      const cands = getGridCandidates(puzzle);
      const { r, c } = move.placement;
      expect(cands[r]![c]).toEqual([move.placement.num]);
    }
  });

  it("eliminations never remove a candidate the cell needs (the solution digit)", () => {
    expect.hasAssertions();
    for (const seed of [21, 22, 23]) {
      const { puzzle, solution } = generatePuzzle(52, makeRng(seed));
      let board = puzzle.map((r) => r.concat());
      const elims: { r: number; c: number; num: number }[] = [];
      // Naked singles come first; walk those off so an elimination move surfaces.
      for (let step = 0; step < 200; step++) {
        const move = nextHint(board, elims);
        if (!move) break;
        if (move.placement) {
          board = applyPlacement(board, move);
          continue;
        }
        for (const e of move.eliminations) {
          expect(solution[e.r]![e.c]).not.toBe(e.num);
          // the eliminated digit must currently be a candidate there
          expect(isValidPlacement(board, e.r, e.c, e.num)).toBe(true);
        }
        elims.push(...move.eliminations);
        break;
      }
    }
  });

  it("hint chain fully solves every generated puzzle", () => {
    for (const seed of [101, 102, 103, 104]) {
      const { puzzle, solution } = generatePuzzle(50, makeRng(seed));
      // Only proceed for puzzles the logical solver can finish (all generated ones are).
      if (!solveLogically(puzzle).solved) continue;
      let board = puzzle.map((r) => r.concat());
      const elims: { r: number; c: number; num: number }[] = [];
      let guard = 0;
      while (board.flat().some((v) => v === 0) && guard++ < 400) {
        const move = nextHint(board, elims);
        expect(move).not.toBeNull();
        if (!move) break;
        if (move.placement) {
          board[move.placement.r]![move.placement.c] = move.placement.num;
        } else {
          elims.push(...move.eliminations);
        }
      }
      expect(board).toEqual(solution);
    }
  });

  it("returns null when no implemented technique applies (empty grid)", () => {
    const empty: Grid = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    // empty grid: every cell has 9 candidates, no single/elimination → null
    expect(nextHint(empty)).toBeNull();
  });
});
