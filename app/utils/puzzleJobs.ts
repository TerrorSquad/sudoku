// Every generator job utils/puzzlePool.ts hands out, run the same way in the worker
// (puzzleWorker.ts) and in place: one function, so a seed gives the same board on either path.
import type { Difficulty } from "../types/sudoku";
import type { TechniqueId } from "./sudokuGrader";

import { generateDailyBoard } from "../composables/useDailyPuzzle";
import { generateLesson, quickLesson } from "./lesson";
import { generatePracticePuzzle } from "./practice";
import { makeRng } from "./sudokuCore";
import { generateGradedPuzzle } from "./sudokuGrader";

export type PuzzleJob =
  | { difficulty: string } // a new game
  | { daily: string; level: Difficulty } // the Daily for a date key
  | { practice: TechniqueId; seed: number } // a full practice puzzle
  | { lesson: TechniqueId; seed: number; quick?: boolean }; // a guided lesson, or a Spot it one

export async function runPuzzleJob(job: PuzzleJob) {
  if ("daily" in job) return { puzzle: generateDailyBoard(job.daily, job.level) };
  if ("practice" in job) return generatePracticePuzzle(job.practice, makeRng(job.seed));
  if ("lesson" in job)
    return (job.quick ? quickLesson : generateLesson)(job.lesson, makeRng(job.seed));
  const { puzzle, solution } = generateGradedPuzzle(job.difficulty);
  return { puzzle, solution };
}
