// Puzzles are generated in a Web Worker, so the main thread never blocks on the generator (Master
// can dig 150 boards): new games, with one per difficulty kept ready, the Dailies, practice puzzles
// and lessons (Spot it's too). Without workers (tests, or a host that blocks them) it generates in
// place, on demand, as before; both paths run utils/puzzleJobs.ts, so a seed gives the same board.
import type { Difficulty, Grid } from "../types/sudoku";
import type { Lesson } from "./lesson";
import type { generatePracticePuzzle } from "./practice";
import type { PuzzleJob } from "./puzzleJobs";
import type { TechniqueId } from "./sudokuGrader";

interface NewPuzzle {
  puzzle: Grid;
  solution: Grid;
}

let worker: Worker | null | undefined; // undefined: not tried yet; null: unavailable
let nextId = 0;
interface Waiting {
  job: PuzzleJob;
  resolve: (result: unknown) => void;
  reject: (err: unknown) => void;
}
const waiting = new Map<number, Waiting>();
const ready = new Map<string, Promise<NewPuzzle>>();

// Async (a generator that throws rejects instead of throwing at the caller) and loaded on first
// use, which keeps the lesson and practice generators out of the page's first load.
const inPlace = async (job: PuzzleJob) => (await import("./puzzleJobs")).runPuzzleJob(job);
const retryInPlace = ({ job, resolve, reject }: Waiting) => void inPlace(job).then(resolve, reject);

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./puzzleWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return (worker = null);
  }
  worker.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
    const { id, result, error } = e.data;
    const w = waiting.get(id);
    waiting.delete(id);
    if (!w) return;
    // The worker's generator threw: one more try here, which rejects if it fails again.
    if (error) retryInPlace(w);
    else w.resolve(result);
  };
  // A worker that fails to load (e.g. a CSP) must not strand the player: finish here instead.
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    for (const w of waiting.values()) retryInPlace(w);
    waiting.clear();
  };
  return worker;
}

function run<T>(job: PuzzleJob): Promise<T> {
  const w = typeof Worker === "undefined" ? null : getWorker();
  if (!w) return inPlace(job) as Promise<T>;
  return new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { job, resolve: resolve as (result: unknown) => void, reject });
    w.postMessage({ id, ...job });
  });
}

const generate = (difficulty: string) => run<NewPuzzle>({ difficulty });

/**
 * Start generating a puzzle for `difficulty` now, if one isn't already on its way. Only with a
 * worker: generating in place would freeze the page for boards that may never be played.
 */
export function prefetchPuzzle(difficulty: string): void {
  if (typeof Worker === "undefined" || !getWorker()) return;
  if (ready.has(difficulty)) return;
  const next = generate(difficulty);
  // A failed one isn't kept (or reported, unless someone takes it).
  next.catch(() => ready.get(difficulty) === next && ready.delete(difficulty));
  ready.set(difficulty, next);
}

/** A fresh puzzle for `difficulty` (instant when prefetched); the next one starts right away. */
export function takePuzzle(difficulty: string): Promise<NewPuzzle> {
  const next = ready.get(difficulty) ?? generate(difficulty);
  ready.delete(difficulty);
  prefetchPuzzle(difficulty);
  return next;
}

/** The `level` Daily of the date key `daily` (generateDailyBoard). */
export const makeDailyBoard = (daily: string, level: Difficulty) =>
  run<{ puzzle: Grid }>({ daily, level }).then((r) => r.puzzle);

/** A practice puzzle for `technique` (generatePracticePuzzle), the same for the same seed. */
export const practicePuzzle = (technique: TechniqueId, seed: number) =>
  run<Awaited<ReturnType<typeof generatePracticePuzzle>>>({ practice: technique, seed });

/** A guided lesson for `technique` (generateLesson), the same for the same seed. */
export const guidedLesson = (technique: TechniqueId, seed: number) =>
  run<Lesson>({ lesson: technique, seed });

/** A Spot it position for `technique` (quickLesson), the same for the same seed. */
export const makeLesson = (technique: TechniqueId, seed: number) =>
  run<Lesson>({ lesson: technique, seed, quick: true });
