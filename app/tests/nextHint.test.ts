import { describe, it, expect } from 'vitest';
import { makeRng, generatePuzzle, isValidPlacement, getGridCandidates } from '../utils/sudokuCore';
import { nextHint, solveLogically, type SolveMove } from '../utils/sudokuGrader';
import type { Grid } from '../types/sudoku';

// Apply a move to a board the way the engine will, returning a fresh board.
function applyPlacement(board: Grid, move: SolveMove): Grid {
  const b = board.map(r => [...r]);
  if (move.placement) b[move.placement.r]![move.placement.c] = move.placement.num;
  return b;
}

describe('nextHint — soundness', () => {
  it('a placement is always the value that actually solves the cell', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { puzzle, solution } = generatePuzzle(45, makeRng(seed));
      let board = puzzle.map(r => [...r]);
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

  it('placements are genuine singles given the candidate state', () => {
    const { puzzle } = generatePuzzle(40, makeRng(11));
    const move = nextHint(puzzle);
    expect(move).not.toBeNull();
    if (move?.placement && move.technique === 'naked-single') {
      const cands = getGridCandidates(puzzle);
      const { r, c } = move.placement;
      expect(cands[r]![c]).toEqual([move.placement.num]);
    }
  });

  it('eliminations never remove a candidate the cell needs (the solution digit)', () => {
    for (const seed of [21, 22, 23]) {
      const { puzzle, solution } = generatePuzzle(52, makeRng(seed));
      const move = nextHint(puzzle);
      if (move && move.eliminations.length) {
        for (const e of move.eliminations) {
          expect(solution[e.r]![e.c]).not.toBe(e.num);
          // the eliminated digit must currently be a candidate there
          expect(isValidPlacement(puzzle, e.r, e.c, e.num)).toBe(true);
        }
      }
    }
  });

  it('hint chain fully solves every generated puzzle', () => {
    for (const seed of [101, 102, 103, 104]) {
      const { puzzle, solution } = generatePuzzle(50, makeRng(seed));
      // Only proceed for puzzles the logical solver can finish (all generated ones are).
      if (!solveLogically(puzzle).solved) continue;
      let board = puzzle.map(r => [...r]);
      const elims: { r: number; c: number; num: number }[] = [];
      let guard = 0;
      while (board.flat().some(v => v === 0) && guard++ < 400) {
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

  it('returns null when no implemented technique applies (empty grid)', () => {
    const empty: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
    // empty grid: every cell has 9 candidates, no single/elimination → null
    expect(nextHint(empty)).toBeNull();
  });
});
