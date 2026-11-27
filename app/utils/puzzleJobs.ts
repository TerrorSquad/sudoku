// Every generator job utils/puzzlePool.ts hands out, run the same way in the worker
// (puzzleWorker.ts) and in place: one function, so a seed gives the same board on either path.
import type { Difficulty, Grid, Variant } from "../types/sudoku";
import type { Level } from "./progression";
import type { TechniqueId } from "./sudokuGrader";

import { generateDailyBoard } from "../composables/useDailyPuzzle";
import { generateLesson, quickLesson } from "./lesson";
import { generatePracticePuzzle } from "./practice";
import { makeRng } from "./sudokuCore";
import { featuredTechnique, generateGradedPuzzle } from "./sudokuGrader";

export type PuzzleJob =
  | { difficulty: string; variant?: Variant } // a new game
  | { daily: string; level: Difficulty } // the Daily for a date key
  | { practice: TechniqueId; seed: number } // a full practice puzzle
  | { lesson: TechniqueId; seed: number; quick?: boolean; level?: Level } // a guided lesson, or a Spot it one
  | { featured: Grid; variant?: Variant }; // a board's featured technique (a resumed or custom one)

// A new game and a Daily carry their featured technique (featuredTechnique), worked out here so
// the game names it at once; it's read off the board after it's made, so never changes the board.
export async function runPuzzleJob(job: PuzzleJob) {
  if ("featured" in job) return featuredTechnique(job.featured, job.variant);
  if ("daily" in job) {
    const puzzle = generateDailyBoard(job.daily, job.level);
    return { puzzle, technique: featuredTechnique(puzzle) };
  }
  if ("practice" in job) return generatePracticePuzzle(job.practice, makeRng(job.seed));
  if ("lesson" in job)
    return job.quick
      ? quickLesson(job.lesson, makeRng(job.seed))
      : generateLesson(job.lesson, makeRng(job.seed), job.level);
  const { puzzle, solution } = generateGradedPuzzle(
    job.difficulty,
    undefined,
    undefined,
    job.variant,
  );
  return { puzzle, solution, technique: featuredTechnique(puzzle, job.variant) };
}
