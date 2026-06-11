import { describe, it, expect } from 'vitest';
import {
  makeRng,
  seedFromString,
  countSolutions,
  hasUniqueSolution,
  solveBoard,
  generateSolvedGrid,
  generatePuzzle,
  isValidPlacement,
  DIFFICULTY_REMOVE_COUNT,
} from '../utils/sudokuCore';
import type { Grid } from '../types/sudoku';

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

describe('sudokuCore — solver', () => {
  it('countSolutions detects multiple solutions', () => {
    // Empty grid has a vast number of solutions; limit caps the count
    const empty: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
    expect(countSolutions(empty, 2)).toBe(2);
  });

  it('countSolutions returns 0 for conflicting givens', () => {
    const board: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
    board[0]![0] = 5;
    board[0]![1] = 5;
    expect(countSolutions(board)).toBe(0);
  });

  it('solveBoard solves a known puzzle to its unique solution', () => {
    const solution = generateSolvedGrid(makeRng(42));
    const { puzzle } = generatePuzzle(40, makeRng(42));
    const solved = solveBoard(puzzle);
    expect(solved).toEqual(solution);
  });
});

describe('sudokuCore — generator', () => {
  it('generateSolvedGrid produces a complete valid grid', () => {
    const grid = generateSolvedGrid(makeRng(1));
    expect(isCompleteValidGrid(grid)).toBe(true);
  });

  it('different seeds produce different grids', () => {
    const a = generateSolvedGrid(makeRng(1));
    const b = generateSolvedGrid(makeRng(2));
    expect(a).not.toEqual(b);
  });

  it('same seed is deterministic', () => {
    const a = generatePuzzle(45, makeRng(seedFromString('2026-06-11')));
    const b = generatePuzzle(45, makeRng(seedFromString('2026-06-11')));
    expect(a.puzzle).toEqual(b.puzzle);
    expect(a.solution).toEqual(b.solution);
  });

  it('puzzle cells match the solution where given', () => {
    const { puzzle, solution } = generatePuzzle(45, makeRng(7));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r]![c] !== 0) expect(puzzle[r]![c]).toBe(solution[r]![c]);
      }
    }
  });

  it.each(Object.entries(DIFFICULTY_REMOVE_COUNT))(
    'generates a uniquely solvable %s puzzle',
    (_difficulty, removeCount) => {
      const { puzzle, solution, removed } = generatePuzzle(removeCount, makeRng(123));
      expect(hasUniqueSolution(puzzle)).toBe(true);
      expect(solveBoard(puzzle)).toEqual(solution);
      expect(removed).toBeGreaterThan(0);
      const blanks = puzzle.flat().filter(v => v === 0).length;
      expect(blanks).toBe(removed);
    }
  );

  it('uniqueness holds across many random generations', () => {
    for (let i = 0; i < 10; i++) {
      const { puzzle } = generatePuzzle(58, makeRng(1000 + i));
      expect(hasUniqueSolution(puzzle)).toBe(true);
    }
  });
});
