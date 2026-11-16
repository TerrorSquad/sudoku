// Runs the generators off the main thread for utils/puzzlePool.ts (the jobs: utils/puzzleJobs.ts).
import { runPuzzleJob, type PuzzleJob } from "./puzzleJobs";

// An async handler's throw never reaches the page's onerror, so every failure is posted back:
// the pool then generates that job in place instead of waiting forever.
self.onmessage = async (e: MessageEvent<PuzzleJob & { id: number }>) => {
  const { id, ...job } = e.data;
  try {
    self.postMessage({ id, result: await runPuzzleJob(job) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
