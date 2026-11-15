// Runs the generators off the main thread for utils/puzzlePool.ts: a graded puzzle for a new game,
// or a Spot it position (a lesson) for a technique.
import type { TechniqueId } from "./sudokuGrader";

import { quickLesson } from "./lesson";
import { makeRng } from "./sudokuCore";
import { generateGradedPuzzle } from "./sudokuGrader";

type Job =
  | { id: number; difficulty: string }
  | { id: number; technique: TechniqueId; seed: number };

self.onmessage = async (e: MessageEvent<Job>) => {
  const job = e.data;
  if ("technique" in job) {
    const lesson = await quickLesson(job.technique, makeRng(job.seed));
    self.postMessage({ id: job.id, lesson });
    return;
  }
  const { puzzle, solution } = generateGradedPuzzle(job.difficulty);
  self.postMessage({ id: job.id, puzzle, solution });
};
