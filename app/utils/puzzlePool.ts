// New-game puzzles are generated in a Web Worker, and one per difficulty is kept ready, so
// starting a game never blocks the main thread on the generator (Master can dig 150 boards).
// Spot it positions (lessons) are made in the same worker. Without workers (tests, or a host that
// blocks them) it generates in place, on demand, as before.
import type { Grid } from "../types/sudoku";
import type { TechniqueId } from "./sudokuGrader";

import { quickLesson, type Lesson } from "./lesson";
import { makeRng } from "./sudokuCore";
import { generateGradedPuzzle } from "./sudokuGrader";

export interface NewPuzzle {
  puzzle: Grid;
  solution: Grid;
}

type Job = { difficulty: string } | { technique: TechniqueId; seed: number };

let worker: Worker | null | undefined; // undefined: not tried yet; null: unavailable
let nextId = 0;
const waiting = new Map<number, { job: Job; resolve: (result: unknown) => void }>();
const ready = new Map<string, Promise<NewPuzzle>>();

function inPlace(job: Job): Promise<NewPuzzle | Lesson> {
  if ("technique" in job) return quickLesson(job.technique, makeRng(job.seed));
  const { puzzle, solution } = generateGradedPuzzle(job.difficulty);
  return Promise.resolve({ puzzle, solution });
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./puzzleWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return (worker = null);
  }
  worker.onmessage = (e: MessageEvent<{ id: number; lesson?: Lesson } & Partial<NewPuzzle>>) => {
    const { id, lesson, puzzle, solution } = e.data;
    waiting.get(id)?.resolve(lesson ?? { puzzle, solution });
    waiting.delete(id);
  };
  // A worker that fails to load (e.g. a CSP) must not strand the player: finish here instead.
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    for (const { job, resolve } of waiting.values()) void inPlace(job).then(resolve);
    waiting.clear();
  };
  return worker;
}

function run<T>(job: Job): Promise<T> {
  const w = typeof Worker === "undefined" ? null : getWorker();
  if (!w) return inPlace(job) as Promise<T>;
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, { job, resolve: resolve as (result: unknown) => void });
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
  if (!ready.has(difficulty)) ready.set(difficulty, generate(difficulty));
}

/** A fresh puzzle for `difficulty` (instant when prefetched); the next one starts right away. */
export function takePuzzle(difficulty: string): Promise<NewPuzzle> {
  const next = ready.get(difficulty) ?? generate(difficulty);
  ready.delete(difficulty);
  prefetchPuzzle(difficulty);
  return next;
}

/** A Spot it position for `technique`, the same for the same seed. */
export const makeLesson = (technique: TechniqueId, seed: number) =>
  run<Lesson>({ technique, seed });
