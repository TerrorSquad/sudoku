// Runs generateGradedPuzzle off the main thread for utils/puzzlePool.ts.
import { generateGradedPuzzle } from "./sudokuGrader";

self.onmessage = (e: MessageEvent<{ id: number; difficulty: string }>) => {
  const { puzzle, solution } = generateGradedPuzzle(e.data.difficulty);
  self.postMessage({ id: e.data.id, puzzle, solution });
};
