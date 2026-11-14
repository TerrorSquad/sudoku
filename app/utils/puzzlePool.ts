// New-game puzzles are generated in a Web Worker, and one per difficulty is kept ready, so
// starting a game never blocks the main thread on the generator (Master can dig 150 boards).
// Without workers (tests, or a host that blocks them) it generates in place, as before.
import type { Grid } from "../types/sudoku";

import { generateGradedPuzzle } from "./sudokuGrader";

export interface NewPuzzle {
  puzzle: Grid;
  solution: Grid;
}

let worker: Worker | null | undefined; // undefined: not tried yet; null: unavailable
let nextId = 0;
const waiting = new Map<number, { difficulty: string; resolve: (p: NewPuzzle) => void }>();
const ready = new Map<string, Promise<NewPuzzle>>();

function inPlace(difficulty: string): NewPuzzle {
  const { puzzle, solution } = generateGradedPuzzle(difficulty);
  return { puzzle, solution };
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./puzzleWorker.ts", import.meta.url), { type: "module" });
  } catch {
    return (worker = null);
  }
  worker.onmessage = (e: MessageEvent<NewPuzzle & { id: number }>) => {
    waiting.get(e.data.id)?.resolve({ puzzle: e.data.puzzle, solution: e.data.solution });
    waiting.delete(e.data.id);
  };
  // A worker that fails to load (e.g. a CSP) must not strand the player: finish here instead.
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    for (const { difficulty, resolve } of waiting.values()) resolve(inPlace(difficulty));
    waiting.clear();
  };
  return worker;
}

function generate(difficulty: string): Promise<NewPuzzle> {
  const w = typeof Worker === "undefined" ? null : getWorker();
  if (!w) return Promise.resolve(inPlace(difficulty));
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, { difficulty, resolve });
    w.postMessage({ id, difficulty });
  });
}

/** Start generating a puzzle for `difficulty` now, if one isn't already on its way. */
export function prefetchPuzzle(difficulty: string): void {
  if (!ready.has(difficulty)) ready.set(difficulty, generate(difficulty));
}

/** A fresh puzzle for `difficulty` (instant when prefetched); the next one starts right away. */
export function takePuzzle(difficulty: string): Promise<NewPuzzle> {
  const next = ready.get(difficulty) ?? generate(difficulty);
  ready.delete(difficulty);
  prefetchPuzzle(difficulty);
  return next;
}
