// New-game puzzles are generated in a Web Worker, and one per difficulty is kept ready, so
// starting a game never blocks the main thread on the generator (Master can dig 150 boards).
// Spot it positions (lessons) are made in the same worker. Without workers (tests, or a host that
// blocks them) it generates in place, on demand, as before.
import type { Grid, Variant } from "../types/sudoku";
import type { TechniqueId } from "./sudokuGrader";

import { quickLesson, type Lesson } from "./lesson";
import { makeRng } from "./sudokuCore";
import { generateGradedPuzzle } from "./sudokuGrader";

interface NewPuzzle {
  puzzle: Grid;
  solution: Grid;
}

type Job = { difficulty: string; variant: Variant } | { technique: TechniqueId; seed: number };

let worker: Worker | null | undefined; // undefined: not tried yet; null: unavailable
let nextId = 0;
interface Waiting {
  job: Job;
  resolve: (result: unknown) => void;
  reject: (err: unknown) => void;
}
const waiting = new Map<number, Waiting>();
const ready = new Map<string, Promise<NewPuzzle>>();

// Async, so a generator that throws rejects instead of throwing at the caller.
async function inPlace(job: Job): Promise<NewPuzzle | Lesson> {
  if ("technique" in job) return quickLesson(job.technique, makeRng(job.seed));
  const { puzzle, solution } = generateGradedPuzzle(
    job.difficulty,
    undefined,
    undefined,
    job.variant,
  );
  return { puzzle, solution };
}
const retryInPlace = ({ job, resolve, reject }: Waiting) => void inPlace(job).then(resolve, reject);

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./puzzleWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return (worker = null);
  }
  worker.onmessage = (
    e: MessageEvent<{ id: number; lesson?: Lesson; error?: string } & Partial<NewPuzzle>>,
  ) => {
    const { id, lesson, puzzle, solution, error } = e.data;
    const w = waiting.get(id);
    waiting.delete(id);
    if (!w) return;
    // The worker's generator threw: one more try here, which rejects if it fails again.
    if (error) retryInPlace(w);
    else w.resolve(lesson ?? { puzzle, solution });
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

function run<T>(job: Job): Promise<T> {
  const w = typeof Worker === "undefined" ? null : getWorker();
  if (!w) return inPlace(job) as Promise<T>;
  return new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { job, resolve: resolve as (result: unknown) => void, reject });
    w.postMessage({ id, ...job });
  });
}

const generate = (difficulty: string, variant: Variant) => run<NewPuzzle>({ difficulty, variant });

/**
 * Start generating a puzzle for `difficulty` now, if one isn't already on its way. Only with a
 * worker: generating in place would freeze the page for boards that may never be played.
 */
export function prefetchPuzzle(difficulty: string, variant: Variant = "classic"): void {
  if (typeof Worker === "undefined" || !getWorker()) return;
  const key = `${variant}:${difficulty}`;
  if (ready.has(key)) return;
  const next = generate(difficulty, variant);
  // A failed one isn't kept (or reported, unless someone takes it).
  next.catch(() => ready.get(key) === next && ready.delete(key));
  ready.set(key, next);
}

/** A fresh puzzle for `difficulty` (instant when prefetched); the next one starts right away. */
export function takePuzzle(difficulty: string, variant: Variant = "classic"): Promise<NewPuzzle> {
  const key = `${variant}:${difficulty}`;
  const next = ready.get(key) ?? generate(difficulty, variant);
  ready.delete(key);
  prefetchPuzzle(difficulty, variant);
  return next;
}

/** A Spot it position for `technique`, the same for the same seed. */
export const makeLesson = (technique: TechniqueId, seed: number) =>
  run<Lesson>({ technique, seed });
