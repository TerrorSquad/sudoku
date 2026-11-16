// Runs the generators off the main thread for utils/puzzlePool.ts: a graded puzzle for a new game,
// or a Spot it position (a lesson) for a technique.
import type { Variant } from "../types/sudoku";
import type { TechniqueId } from "./sudokuGrader";

import { quickLesson } from "./lesson";
import { makeRng } from "./sudokuCore";
import { generateGradedPuzzle } from "./sudokuGrader";

type Job =
  | { id: number; difficulty: string; variant: Variant }
  | { id: number; technique: TechniqueId; seed: number };

// An async handler's throw never reaches the page's onerror, so every failure is posted back:
// the pool then generates that job in place instead of waiting forever.
self.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  try {
    if ("technique" in job) {
      const lesson = await quickLesson(job.technique, makeRng(job.seed));
      self.postMessage({ id: job.id, lesson });
      return;
    }
    const { puzzle, solution } = generateGradedPuzzle(
      job.difficulty,
      undefined,
      undefined,
      job.variant,
    );
    self.postMessage({ id: job.id, puzzle, solution });
  } catch (err) {
    self.postMessage({ id: job.id, error: String(err) });
  }
};
