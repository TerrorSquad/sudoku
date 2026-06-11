import { describe, it, expect } from 'vitest';
import { makeRng, generatePuzzle, hasUniqueSolution, solveBoard } from '../utils/sudokuCore';
import { solveLogically, gradePuzzle, generateGradedPuzzle } from '../utils/sudokuGrader';
import type { Grid } from '../types/sudoku';

describe('sudokuGrader — logical solver', () => {
  it('grades a nearly-full puzzle as singles (grade 1)', () => {
    const { puzzle } = generatePuzzle(20, makeRng(5));
    expect(gradePuzzle(puzzle)).toBe(1);
  });

  it('logical solution matches the backtracking solution when solvable', () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const { puzzle, solution } = generatePuzzle(45, makeRng(seed));
      const result = solveLogically(puzzle);
      if (result.solved) {
        expect(result.board).toEqual(solution);
        expect(solveBoard(puzzle)).toEqual(solution);
      }
    }
  });

  it('never reports solved=true with an incomplete or wrong board', () => {
    const { puzzle } = generatePuzzle(60, makeRng(99));
    const result = solveLogically(puzzle);
    const flat = result.board.flat();
    if (result.solved) {
      expect(flat.every(v => v >= 1 && v <= 9)).toBe(true);
    } else {
      expect(result.grade).toBe(5);
      expect(flat.some(v => v === 0)).toBe(true);
    }
  });

  it('grades the empty grid as 5 (not logically solvable)', () => {
    const empty: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
    expect(gradePuzzle(empty)).toBe(5);
  });
});

describe('sudokuGrader — graded generation', () => {
  it.each(['beginner', 'easy', 'medium', 'hard', 'expert', 'master'])(
    'generates a unique-solution %s puzzle with a grade',
    (difficulty) => {
      const gp = generateGradedPuzzle(difficulty, makeRng(2026));
      expect(hasUniqueSolution(gp.puzzle)).toBe(true);
      expect(gp.grade).toBeGreaterThanOrEqual(1);
      expect(gp.grade).toBeLessThanOrEqual(5);
      expect(solveBoard(gp.puzzle)).toEqual(gp.solution);
    }
  );

  it('beginner puzzles are always solvable with singles only', () => {
    for (const seed of [1, 2, 3]) {
      const gp = generateGradedPuzzle('beginner', makeRng(seed));
      expect(gp.grade).toBe(1);
    }
  });

  it('expert puzzles require advanced techniques (grade >= 3)', () => {
    const gp = generateGradedPuzzle('expert', makeRng(7));
    expect(gp.grade).toBeGreaterThanOrEqual(3);
  });
});
