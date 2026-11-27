// Every generator job utils/puzzlePool.ts hands out, run the same way in the worker
// (puzzleWorker.ts) and in place: one function, so a seed gives the same board on either path.
import type { Difficulty, Variant } from "../types/sudoku";
import type { Level } from "./progression";
import type { StuckPosition } from "./review";
import type { TechniqueId } from "./sudokuGrader";

import { generateDailyBoard } from "../composables/useDailyPuzzle";
import { generateLesson, lessonFromPosition, quickLesson } from "./lesson";
import { generatePracticePuzzle } from "./practice";
import { makeRng } from "./sudokuCore";
import { generateGradedPuzzle } from "./sudokuGrader";

export type PuzzleJob =
  | { difficulty: string; variant?: Variant } // a new game
  | { daily: string; level: Difficulty } // the Daily for a date key
  | { practice: TechniqueId; seed: number } // a full practice puzzle
  | { lesson: TechniqueId; seed: number; quick?: boolean; level?: Level } // a guided lesson, or a Spot it one
  | { lesson: TechniqueId; from: StuckPosition }; // a review on the player's own position, or null

export async function runPuzzleJob(job: PuzzleJob) {
  if ("daily" in job) return { puzzle: generateDailyBoard(job.daily, job.level) };
  if ("practice" in job) return generatePracticePuzzle(job.practice, makeRng(job.seed));
  if ("from" in job) return lessonFromPosition(job.from, job.lesson);
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
  return { puzzle, solution };
}
